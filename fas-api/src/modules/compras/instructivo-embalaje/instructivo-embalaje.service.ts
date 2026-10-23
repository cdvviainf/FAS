import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import { validarCalidadesPermitidas } from '../../../shared/calidades-permitidas.js'
import * as repo from './instructivo-embalaje.repository.js'
import type { InstructivoEmbalajeCreateInput, InstructivoEmbalajeDetalleInput, InstructivoEmbalajeUpdateInput } from './instructivo-embalaje.types.js'

async function validarLinea(linea: InstructivoEmbalajeDetalleInput, index: number) {
  const prefijo = `Línea ${index + 1}:`

  const mercado = await repo.getMercado(linea.mercadoId)
  if (!mercado) throw new ValidationError(`${prefijo} el mercado seleccionado no existe o está bloqueado`)

  const especie = await repo.getEspecie(linea.especieId)
  if (!especie) throw new ValidationError(`${prefijo} la especie seleccionada no existe o está bloqueada`)

  const articulo = await repo.getArticuloTipo(linea.articuloId)
  if (!articulo) throw new ValidationError(`${prefijo} el artículo de embalaje seleccionado no existe`)
  if (articulo.tipo !== 'EMBALAJE') {
    throw new ValidationError(`${prefijo} el artículo debe ser de tipo Embalaje`)
  }
  if (!articulo.activo) throw new ValidationError(`${prefijo} el artículo de embalaje seleccionado está inactivo`)

  const variedad = await repo.getVariedad(linea.variedadId)
  if (!variedad) throw new ValidationError(`${prefijo} la variedad seleccionada no existe o está bloqueada`)
  if (variedad.especieId !== linea.especieId) {
    throw new ValidationError(`${prefijo} la variedad no pertenece a la especie seleccionada`)
  }

  if (linea.variedadRotuladaId != null) {
    const variedadRotulada = await repo.getVariedad(linea.variedadRotuladaId)
    if (!variedadRotulada) throw new ValidationError(`${prefijo} la variedad rotulada seleccionada no existe o está bloqueada`)
    if (variedadRotulada.especieId !== linea.especieId) {
      throw new ValidationError(`${prefijo} la variedad rotulada no pertenece a la especie seleccionada`)
    }
  }

  const categoria = await repo.getCategoria(linea.categoriaId)
  if (!categoria) throw new ValidationError(`${prefijo} la categoría seleccionada no existe o está bloqueada`)
  if (categoria.especieId !== linea.especieId) {
    throw new ValidationError(`${prefijo} la categoría no pertenece a la especie seleccionada`)
  }

  const calibres = await repo.getCalibresActivos(linea.calibreIds)
  if (calibres.length !== new Set(linea.calibreIds).size) {
    throw new ValidationError(`${prefijo} uno o más calibres seleccionados no existen o están bloqueados`)
  }
  if (calibres.some((c) => c.especieId !== linea.especieId)) {
    throw new ValidationError(`${prefijo} uno o más calibres no pertenecen a la especie seleccionada`)
  }

  if (linea.tipoPalletId != null) {
    const tipoPallet = await repo.getTipoPallet(linea.tipoPalletId)
    if (!tipoPallet) throw new ValidationError(`${prefijo} el tipo de pallet seleccionado no existe o está bloqueado`)
  }

  const altura = await repo.getAltura(linea.alturaId)
  if (!altura) throw new ValidationError(`${prefijo} la altura de pallet seleccionada no existe o está bloqueada`)

  // Etiqueta de la línea: una sola, dentro del set permitido del artículo
  // (principal ∪ adicionales) — misma regla que la Orden de Compra. FIJA (1
  // permitida) → se autocompleta; DINÁMICA (>1) → debe venir elegida.
  const permitidas = new Set<number>()
  if (articulo.etiquetaId != null) permitidas.add(articulo.etiquetaId)
  for (const a of articulo.etiquetasAdicionales) permitidas.add(a.etiquetaId)
  if (permitidas.size === 0) {
    throw new ValidationError(`${prefijo} el artículo "${articulo.descripcion}" no tiene etiqueta configurada — defínela en el maestro de Artículos`)
  }
  if (linea.etiquetaId != null) {
    if (!permitidas.has(linea.etiquetaId)) {
      throw new ValidationError(`${prefijo} la etiqueta seleccionada no está permitida para el artículo "${articulo.descripcion}"`)
    }
  } else if (permitidas.size === 1) {
    linea.etiquetaId = [...permitidas][0] // etiqueta fija heredada del maestro (se persiste)
  } else {
    throw new ValidationError(`${prefijo} el artículo "${articulo.descripcion}" tiene etiqueta dinámica — selecciona la marca (etiqueta)`)
  }
}

async function validarReferenciasHeader(data: { entidadProductorId?: number; exportadorId?: number | null }) {
  if (data.entidadProductorId != null) {
    const productor = await repo.getEntidadProductor(data.entidadProductorId)
    if (!productor) throw new ValidationError('El productor seleccionado no existe o está inactivo')
    if (!productor.tipos.includes('PRODUCTOR')) {
      throw new ValidationError('La entidad seleccionada no tiene tipo Productor')
    }
  }
  if (data.exportadorId != null) {
    const exportador = await repo.getExportador(data.exportadorId)
    if (!exportador) throw new ValidationError('El exportador seleccionado no existe o está inactivo')
    if (!exportador.tipos.includes('EXPORTADORA')) {
      throw new ValidationError('La entidad seleccionada no tiene tipo Exportador')
    }
  }
}

export async function listarInstructivos(page: number, limit: number, entidadProductorId?: number) {
  const { data, total } = await repo.listInstructivos(page, limit, entidadProductorId)
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function obtenerInstructivo(id: number) {
  const instructivo = await repo.getInstructivoById(id)
  if (!instructivo) throw new NotFoundError('Instructivo de Embalaje', String(id))
  return instructivo
}

export async function crearInstructivo(body: InstructivoEmbalajeCreateInput, creadoPor: string) {
  await validarReferenciasHeader(body)
  await validarCalidadesPermitidas(body.calidadesPermitidas ?? [])

  for (const [index, linea] of body.detalle.entries()) {
    await validarLinea(linea, index)
  }

  return repo.createInstructivo(body, creadoPor)
}

// Sin máquina de estados (2026-09-02: Calidad ya no emite veredicto sobre el
// Instructivo, ver compras.md §4.1) — editable/eliminable libremente.
export async function actualizarInstructivo(id: number, body: InstructivoEmbalajeUpdateInput) {
  await obtenerInstructivo(id)

  await validarReferenciasHeader(body)
  if (body.calidadesPermitidas !== undefined) {
    await validarCalidadesPermitidas(body.calidadesPermitidas)
  }

  if (body.detalle) {
    for (const [index, linea] of body.detalle.entries()) {
      await validarLinea(linea, index)
    }
  }

  const actualizado = await repo.updateInstructivo(id, body)
  if (actualizado === null) {
    throw new NotFoundError('Instructivo de Embalaje', String(id)) // eliminado justo ahora
  }
  return actualizado
}

export async function eliminarInstructivo(id: number, eliminadoPor: string) {
  await obtenerInstructivo(id)
  const count = await repo.softDeleteInstructivo(id, eliminadoPor)
  if (count === 0) {
    throw new NotFoundError('Instructivo de Embalaje', String(id)) // eliminado justo ahora
  }
}
