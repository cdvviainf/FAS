import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './articulos.repository.js'
import type { ArticuloCreateInput, ArticuloUpdateInput, ArticuloListFilters } from './articulos.types.js'

// R3/R4: coherencia tipo de costeo / tipo de artículo
function validarCosteo(tipo: string | undefined, tipoCosteo: string | undefined, valorEstandar: number | null | undefined) {
  if (tipo === 'SERVICIO' && tipoCosteo && tipoCosteo !== 'ESTANDAR') {
    throw new ValidationError('Los artículos de tipo Servicio deben tener costeo Estándar (R4)')
  }
  if (tipoCosteo === 'ESTANDAR' && (valorEstandar == null)) {
    throw new ValidationError('El valor estándar es requerido cuando el costeo es Estándar (R3)')
  }
}

// La etiqueta es requerida solo para artículos tipo Embalaje.
function validarEtiqueta(tipo: string | undefined, etiquetaId: number | null | undefined) {
  if (tipo === 'EMBALAJE' && etiquetaId == null) {
    throw new ValidationError('La etiqueta es requerida para artículos de tipo Embalaje')
  }
}

// Etiquetas adicionales permitidas (2026-10-12): solo para EMBALAJE, distintas
// entre sí y distintas de la principal. Devuelve la lista saneada (vacía si no
// aplica). La validación de existencia/activa de cada una se hace aparte.
function sanearEtiquetasAdicionales(
  tipo: string | undefined,
  etiquetaPrincipalId: number | null | undefined,
  adicionales: number[] | undefined,
): number[] {
  if (adicionales === undefined) return []
  if (adicionales.length === 0) return []
  if (tipo !== 'EMBALAJE') {
    throw new ValidationError('Solo los artículos de tipo Embalaje pueden tener etiquetas adicionales')
  }
  const unicas = [...new Set(adicionales)]
  if (unicas.length !== adicionales.length) {
    throw new ValidationError('Hay etiquetas adicionales repetidas')
  }
  if (etiquetaPrincipalId != null && unicas.includes(etiquetaPrincipalId)) {
    throw new ValidationError('La etiqueta principal no debe repetirse en las etiquetas adicionales')
  }
  return unicas
}

async function validarEtiquetasActivas(ids: number[]) {
  for (const id of ids) {
    const etiqueta = await repo.getEtiquetaActiva(id)
    if (!etiqueta) throw new ValidationError('Una de las etiquetas adicionales no existe, está bloqueada o fue eliminada')
  }
}

function controlaStockDe(tipoCosteo: string): boolean {
  return tipoCosteo === 'PROMEDIO_PONDERADO'
}

export async function listarArticulos(filters: ArticuloListFilters) {
  const { data, total } = await repo.listArticulos(filters)
  const { page = 1, limit = 20 } = filters
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function obtenerArticulo(id: number) {
  const articulo = await repo.getArticuloById(id)
  if (!articulo) throw new NotFoundError('Artículo', String(id))
  return articulo
}

export async function crearArticulo(body: ArticuloCreateInput) {
  const existente = await repo.findArticuloByCodigo(body.codigo)
  if (existente) throw new ValidationError(`Ya existe un artículo con código "${body.codigo}"`)

  validarCosteo(body.tipo, body.tipoCosteo, body.valorEstandar)
  validarEtiqueta(body.tipo, body.etiquetaId)

  // ART-04: la unidad de medida debe existir, no estar eliminada ni bloqueada
  const unidad = await repo.getUnidadMedidaActiva(body.unidadId)
  if (!unidad) throw new ValidationError('La unidad de medida seleccionada no existe, está bloqueada o fue eliminada')

  if (body.etiquetaId != null) {
    const etiqueta = await repo.getEtiquetaActiva(body.etiquetaId)
    if (!etiqueta) throw new ValidationError('La etiqueta seleccionada no existe, está bloqueada o fue eliminada')
  }

  const adicionales = sanearEtiquetasAdicionales(body.tipo, body.etiquetaId, body.etiquetaIdsAdicionales)
  await validarEtiquetasActivas(adicionales)

  return repo.createArticulo({
    ...body,
    etiquetaIdsAdicionales: adicionales,
    controlaStock: controlaStockDe(body.tipoCosteo),
  })
}

export async function actualizarArticulo(id: number, body: ArticuloUpdateInput) {
  const actual = await obtenerArticulo(id)

  const tipo = body.tipo ?? actual.tipo
  const tipoCosteo = body.tipoCosteo ?? actual.tipoCosteo
  const valorEstandar = body.valorEstandar !== undefined ? body.valorEstandar : actual.valorEstandar ? Number(actual.valorEstandar) : null
  validarCosteo(tipo, tipoCosteo, valorEstandar)

  const etiquetaId = body.etiquetaId !== undefined ? body.etiquetaId : actual.etiquetaId
  validarEtiqueta(tipo, etiquetaId)

  // ART-04: si se cambia la unidad, validar que la nueva esté activa
  if (body.unidadId !== undefined) {
    const unidad = await repo.getUnidadMedidaActiva(body.unidadId)
    if (!unidad) throw new ValidationError('La unidad de medida seleccionada no existe, está bloqueada o fue eliminada')
  }

  // Si se cambia la etiqueta, validar que la nueva esté activa
  if (body.etiquetaId !== undefined && body.etiquetaId !== null) {
    const etiqueta = await repo.getEtiquetaActiva(body.etiquetaId)
    if (!etiqueta) throw new ValidationError('La etiqueta seleccionada no existe, está bloqueada o fue eliminada')
  }

  const data: ArticuloUpdateInput & { controlaStock?: boolean } = { ...body }
  if (body.tipoCosteo !== undefined) {
    data.controlaStock = controlaStockDe(body.tipoCosteo)
  }

  // Etiquetas adicionales: si vienen en el body se reemplazan; si el artículo
  // dejó de ser EMBALAJE se limpian aunque el body no las mande; en cualquier
  // otro caso (undefined) no se tocan.
  if (body.etiquetaIdsAdicionales !== undefined) {
    const adicionales = sanearEtiquetasAdicionales(tipo, etiquetaId, body.etiquetaIdsAdicionales)
    await validarEtiquetasActivas(adicionales)
    data.etiquetaIdsAdicionales = adicionales
  } else if (tipo !== 'EMBALAJE') {
    data.etiquetaIdsAdicionales = []
  } else if (body.etiquetaId !== undefined && etiquetaId != null) {
    // Invariante principal != adicional: si el PATCH cambia sólo la etiqueta
    // principal a una que ya figuraba como adicional, se la quita de las
    // adicionales (reemplaza la lista con las existentes menos la nueva principal).
    const existentes = (actual.etiquetasAdicionales ?? []).map((e) => e.etiquetaId)
    if (existentes.includes(etiquetaId)) {
      data.etiquetaIdsAdicionales = existentes.filter((x) => x !== etiquetaId)
    }
  }

  return repo.updateArticulo(id, data)
}

// ─── Documentos ──────────────────────────────────────────────────────────────

const MIMES_PERMITIDOS = new Set([
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
])
export const MAX_DOCUMENTO_BYTES = 10 * 1024 * 1024

export async function subirDocumento(
  articuloId: number,
  archivo: { nombre: string; mime: string; datos: Buffer },
  subidoPor: string,
) {
  await obtenerArticulo(articuloId)
  if (!MIMES_PERMITIDOS.has(archivo.mime)) {
    throw new ValidationError('Tipo de archivo no permitido. Se aceptan: PDF, Excel, Word e imágenes')
  }
  if (archivo.datos.length > MAX_DOCUMENTO_BYTES) {
    throw new ValidationError('El archivo supera el tamaño máximo de 10 MB')
  }
  return repo.createDocumento(
    articuloId,
    { nombre: archivo.nombre, mime: archivo.mime, tamano: archivo.datos.length },
    archivo.datos,
    subidoPor,
  )
}

export async function listarDocumentos(articuloId: number) {
  await obtenerArticulo(articuloId)
  return repo.listDocumentos(articuloId)
}

export async function descargarDocumento(articuloId: number, documentoId: number) {
  await obtenerArticulo(articuloId)
  const meta = await repo.getDocumentoMeta(articuloId, documentoId)
  if (!meta) throw new NotFoundError('Documento', String(documentoId))
  const contenido = await repo.getDocumentoContenido(documentoId)
  if (!contenido) throw new NotFoundError('Contenido de documento', String(documentoId))
  return { meta, datos: Buffer.from(contenido.datos) }
}

export async function eliminarDocumento(articuloId: number, documentoId: number) {
  await obtenerArticulo(articuloId)
  const meta = await repo.getDocumentoMeta(articuloId, documentoId)
  if (!meta) throw new NotFoundError('Documento', String(documentoId))
  await repo.deleteDocumento(documentoId)
}
