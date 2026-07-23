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

  // ART-04: la unidad de medida debe existir, no estar eliminada ni bloqueada
  const unidad = await repo.getUnidadMedidaActiva(body.unidadId)
  if (!unidad) throw new ValidationError('La unidad de medida seleccionada no existe, está bloqueada o fue eliminada')

  return repo.createArticulo({
    ...body,
    controlaStock: controlaStockDe(body.tipoCosteo),
  })
}

export async function actualizarArticulo(id: number, body: ArticuloUpdateInput) {
  const actual = await obtenerArticulo(id)

  const tipo = body.tipo ?? actual.tipo
  const tipoCosteo = body.tipoCosteo ?? actual.tipoCosteo
  const valorEstandar = body.valorEstandar !== undefined ? body.valorEstandar : actual.valorEstandar ? Number(actual.valorEstandar) : null
  validarCosteo(tipo, tipoCosteo, valorEstandar)

  // ART-04: si se cambia la unidad, validar que la nueva esté activa
  if (body.unidadId !== undefined) {
    const unidad = await repo.getUnidadMedidaActiva(body.unidadId)
    if (!unidad) throw new ValidationError('La unidad de medida seleccionada no existe, está bloqueada o fue eliminada')
  }

  const data: ArticuloUpdateInput & { controlaStock?: boolean } = { ...body }
  if (body.tipoCosteo !== undefined) {
    data.controlaStock = controlaStockDe(body.tipoCosteo)
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
  const meta = await repo.getDocumentoMeta(articuloId, documentoId)
  if (!meta) throw new NotFoundError('Documento', String(documentoId))
  const contenido = await repo.getDocumentoContenido(documentoId)
  if (!contenido) throw new NotFoundError('Contenido de documento', String(documentoId))
  return { meta, datos: Buffer.from(contenido.datos) }
}

export async function eliminarDocumento(articuloId: number, documentoId: number) {
  const meta = await repo.getDocumentoMeta(articuloId, documentoId)
  if (!meta) throw new NotFoundError('Documento', String(documentoId))
  await repo.deleteDocumento(documentoId)
}
