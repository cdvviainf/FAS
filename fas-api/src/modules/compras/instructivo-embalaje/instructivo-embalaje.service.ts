import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './instructivo-embalaje.repository.js'
import type { InstructivoEmbalajeCreateInput, InstructivoEmbalajeDetalleInput, InstructivoEmbalajeUpdateInput } from './instructivo-embalaje.types.js'

async function validarLinea(linea: InstructivoEmbalajeDetalleInput, index: number) {
  const prefijo = `Línea ${index + 1}:`

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
}

async function validarReferenciasHeader(data: { entidadProductorId?: number; grupoMercadoId?: number }) {
  if (data.entidadProductorId != null) {
    const productor = await repo.getEntidadProductor(data.entidadProductorId)
    if (!productor) throw new ValidationError('El productor seleccionado no existe o está inactivo')
    if (!productor.tipos.includes('PRODUCTOR')) {
      throw new ValidationError('La entidad seleccionada no tiene tipo Productor')
    }
  }
  if (data.grupoMercadoId != null) {
    const grupoMercado = await repo.getGrupoMercado(data.grupoMercadoId)
    if (!grupoMercado) throw new ValidationError('El grupo de mercado seleccionado no existe o está bloqueado')
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

  for (const [index, linea] of body.detalle.entries()) {
    await validarLinea(linea, index)
  }

  return repo.createInstructivo(body, creadoPor)
}

// Sin estado propio (compras.md §4.1) — no hay transición que bloquee la
// edición, a diferencia de la OC (`RECEPCIONADA`). Confirmado además que el
// Instructivo no depende del estado de la NV (Docs/Hallazgos/
// notas-venta-instructivo-embalaje.md, NV-IE-002/003) — ni de la NV en
// absoluto desde la supersesión 2026-08-12 (ver compras.md §4.1).
export async function actualizarInstructivo(id: number, body: InstructivoEmbalajeUpdateInput) {
  await obtenerInstructivo(id)

  await validarReferenciasHeader(body)

  if (body.detalle) {
    for (const [index, linea] of body.detalle.entries()) {
      await validarLinea(linea, index)
    }
  }

  return repo.updateInstructivo(id, body)
}

// Soft delete — sin transición de estado que lo bloquee, mismo criterio que
// la edición (ver nota arriba).
export async function eliminarInstructivo(id: number, eliminadoPor: string) {
  await obtenerInstructivo(id)
  await repo.softDeleteInstructivo(id, eliminadoPor)
}
