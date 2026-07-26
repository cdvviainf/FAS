import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './contratos.repository.js'
import { findEntidadById } from '../../config/entidades/entidades.repository.js'
import type { ContratoCreateInput, ContratoLineaInput, ContratoUpdateInput } from './contratos.types.js'

async function validarProductor(entidadId: number) {
  const entidad = await findEntidadById(entidadId)
  if (!entidad) throw new NotFoundError('Entidad', String(entidadId))
  if (!entidad.tipos.includes('PRODUCTOR')) {
    throw new ValidationError('La entidad seleccionada no es de tipo Productor')
  }
}

export async function listarContratos(entidadId: number) {
  await validarProductor(entidadId)
  return repo.listContratosPorEntidad(entidadId)
}

export async function obtenerContrato(entidadId: number, contratoId: number) {
  const contrato = await repo.getContratoById(entidadId, contratoId)
  if (!contrato) throw new NotFoundError('Contrato', String(contratoId))
  return contrato
}

async function validarLinea(especieId: number, linea: ContratoLineaInput, index: number) {
  const prefijo = `Línea ${index + 1}:`

  const articulo = await repo.getArticuloTipo(linea.articuloId)
  if (!articulo) throw new ValidationError(`${prefijo} el artículo de embalaje seleccionado no existe`)
  if (articulo.tipo !== 'EMBALAJE') throw new ValidationError(`${prefijo} el artículo debe ser de tipo Embalaje`)
  if (!articulo.activo) throw new ValidationError(`${prefijo} el artículo de embalaje seleccionado está inactivo`)

  const variedad = await repo.getVariedad(linea.variedadId)
  if (!variedad) throw new ValidationError(`${prefijo} la variedad seleccionada no existe o está bloqueada`)
  if (variedad.especieId !== especieId) {
    throw new ValidationError(`${prefijo} la variedad no pertenece a la especie del contrato`)
  }

  const categoria = await repo.getCategoria(linea.categoriaId)
  if (!categoria) throw new ValidationError(`${prefijo} la categoría seleccionada no existe o está bloqueada`)
  if (categoria.especieId !== especieId) {
    throw new ValidationError(`${prefijo} la categoría no pertenece a la especie del contrato`)
  }

  const unidadMedida = await repo.getUnidadMedida(linea.unidadMedidaId)
  if (!unidadMedida) throw new ValidationError(`${prefijo} la unidad de medida seleccionada no existe o está bloqueada`)

  const [calibreDesde, calibreHasta] = await Promise.all([
    repo.getCalibre(linea.calibreDesdeId),
    repo.getCalibre(linea.calibreHastaId),
  ])
  if (!calibreDesde || !calibreHasta) {
    throw new ValidationError(`${prefijo} uno o ambos calibres del rango no existen o están bloqueados`)
  }
  if (calibreDesde.especieId !== especieId || calibreHasta.especieId !== especieId) {
    throw new ValidationError(`${prefijo} el rango de calibre no pertenece a la especie del contrato`)
  }
  if (calibreDesde.orden > calibreHasta.orden) {
    throw new ValidationError(`${prefijo} el calibre "desde" debe preceder (o igualar) al calibre "hasta" en el orden del maestro`)
  }
}

// PROD-03: la temporada debe existir, no estar eliminada ni bloqueada; la especie debe existir
async function validarReferenciasHeader(body: ContratoCreateInput | ContratoUpdateInput) {
  if (body.temporadaId != null) {
    const temporada = await repo.getTemporadaActiva(body.temporadaId)
    if (!temporada) throw new ValidationError('La temporada seleccionada no existe, está bloqueada o fue eliminada')
  }
  if (body.especieId != null) {
    const especie = await repo.getEspecie(body.especieId)
    if (!especie) throw new ValidationError('La especie seleccionada no existe o está bloqueada')
  }
}

// Un solo contrato activo por combinación especie-temporada, por productor
async function validarUnicoPorEspecieTemporada(
  entidadId: number,
  especieId: number,
  temporadaId: number,
  excluirId?: number,
) {
  const existentes = await repo.contarContratosPorEspecieTemporada(entidadId, especieId, temporadaId, excluirId)
  if (existentes > 0) {
    throw new ValidationError('Este productor ya tiene un contrato para esa especie en la temporada seleccionada')
  }
}

// R3: bloquear la creación de contrato si el productor no tiene representante legal
export async function crearContrato(entidadId: number, body: ContratoCreateInput, userId: string) {
  await validarProductor(entidadId)
  const tieneRepLegal = await repo.tieneRepresentanteLegal(entidadId)
  if (!tieneRepLegal) {
    throw new ValidationError(
      'El productor debe tener un representante legal (con RUT) registrado antes de crear un contrato (R3)',
    )
  }
  await validarReferenciasHeader(body)
  await validarUnicoPorEspecieTemporada(entidadId, body.especieId, body.temporadaId)
  for (const [index, linea] of body.lineas.entries()) {
    await validarLinea(body.especieId, linea, index)
  }
  return repo.createContrato(entidadId, body, userId)
}

export async function actualizarContrato(entidadId: number, contratoId: number, body: ContratoUpdateInput, userId: string) {
  const existente = await obtenerContrato(entidadId, contratoId)
  await validarReferenciasHeader(body)
  const especieId = body.especieId ?? existente.especieId
  const temporadaId = body.temporadaId ?? existente.temporadaId
  if (body.especieId != null || body.temporadaId != null) {
    await validarUnicoPorEspecieTemporada(entidadId, especieId, temporadaId, contratoId)
  }
  if (body.lineas) {
    for (const [index, linea] of body.lineas.entries()) {
      await validarLinea(especieId, linea, index)
    }
  }
  return repo.updateContrato(contratoId, body, userId)
}

export async function eliminarContrato(entidadId: number, contratoId: number, userId: string) {
  await obtenerContrato(entidadId, contratoId)
  await repo.softDeleteContrato(contratoId, userId)
}

// ─── Documentos adjuntos ──────────────────────────────────────────────────────

export const MAX_ADJUNTO_BYTES = 15 * 1024 * 1024

export async function agregarAdjunto(
  entidadId: number,
  contratoId: number,
  archivo: { nombre: string; mime: string; datos: Buffer },
  userId: string,
) {
  await obtenerContrato(entidadId, contratoId)
  if (archivo.datos.length > MAX_ADJUNTO_BYTES) {
    throw new ValidationError('El archivo supera el tamaño máximo de 15 MB')
  }
  return repo.agregarAdjunto(
    contratoId,
    { nombre: archivo.nombre, mime: archivo.mime, tamano: archivo.datos.length },
    archivo.datos,
    userId,
  )
}

export async function descargarAdjunto(entidadId: number, contratoId: number, adjuntoId: number) {
  await obtenerContrato(entidadId, contratoId)
  const adjunto = await repo.getAdjunto(contratoId, adjuntoId)
  if (!adjunto) throw new NotFoundError('Adjunto', String(adjuntoId))
  const contenido = await repo.getAdjuntoContenido(adjuntoId)
  if (!contenido) throw new NotFoundError('Contenido del adjunto', String(adjuntoId))
  return { meta: { nombre: adjunto.nombre, mime: adjunto.mime }, datos: Buffer.from(contenido.datos) }
}

export async function eliminarAdjunto(entidadId: number, contratoId: number, adjuntoId: number) {
  await obtenerContrato(entidadId, contratoId)
  const adjunto = await repo.getAdjunto(contratoId, adjuntoId)
  if (!adjunto) throw new NotFoundError('Adjunto', String(adjuntoId))
  await repo.eliminarAdjunto(adjuntoId)
}
