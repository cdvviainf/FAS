import { Prisma } from '@prisma/client'
import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './recepciones.repository.js'
import type { RecepcionCreateInput, RecepcionUpdateInput } from './recepciones.types.js'

const MIMES_EXCEL_PERMITIDOS = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])
export const MAX_ADJUNTO_BYTES = 10 * 1024 * 1024 // 10 MB

async function validarPlantaYDireccion(plantaId?: number, direccionPlantaId?: number) {
  if (plantaId == null) return
  const planta = await repo.getEntidadPlanta(plantaId)
  if (!planta) throw new ValidationError('La planta seleccionada no existe')
  if (!planta.activo) throw new ValidationError('La planta seleccionada está inactiva')
  if (!planta.tipos.includes('PLANTA')) throw new ValidationError('La entidad seleccionada no tiene tipo Planta')

  if (direccionPlantaId == null) return
  const direccion = await repo.getDireccionDeEntidad(direccionPlantaId, plantaId)
  if (!direccion) throw new ValidationError('La dirección seleccionada no pertenece a la planta')
}

async function validarOrdenCompra(ordenCompraId?: number | null) {
  if (ordenCompraId == null) return
  const oc = await repo.getOrdenCompra(ordenCompraId)
  if (!oc) throw new ValidationError('La Orden de Compra seleccionada no existe')
  if (oc.estado !== 'EMITIDA') {
    throw new ValidationError('Solo se puede recepcionar una Orden de Compra en estado Emitida')
  }
  const recepcionActiva = await repo.getRecepcionActivaPorOrdenCompra(ordenCompraId)
  if (recepcionActiva) throw new ValidationError('La Orden de Compra seleccionada ya tiene una Recepción asociada')
}

async function validarTemplateCarga(templateCargaId?: number | null) {
  if (templateCargaId == null) return
  const template = await repo.getTemplateCarga(templateCargaId)
  if (!template) throw new ValidationError('El template de carga seleccionado no existe')
  if (template.bloqueado) throw new ValidationError('El template de carga seleccionado está bloqueado')
}

export async function listarRecepciones(page: number, limit: number, plantaId?: number, origen?: string, estado?: string) {
  const { data, total } = await repo.listRecepciones(page, limit, plantaId, origen, estado)
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function obtenerRecepcion(id: number) {
  const recepcion = await repo.getRecepcionById(id)
  if (!recepcion) throw new NotFoundError('Recepción', String(id))
  return recepcion
}

export async function crearRecepcion(body: RecepcionCreateInput, creadoPor: string) {
  await validarOrdenCompra(body.ordenCompraId)
  await validarPlantaYDireccion(body.plantaId, body.direccionPlantaId)
  await validarTemplateCarga(body.templateCargaId)
  try {
    return await repo.createRecepcion(body, creadoPor)
  } catch (err) {
    // El check-then-create de arriba no es atómico: si dos solicitudes
    // concurrentes pasan la validación a la vez, el índice único parcial de
    // BD (WHERE eliminadoEn IS NULL) rechaza la segunda inserción.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ValidationError('La Orden de Compra seleccionada ya tiene una Recepción asociada')
    }
    throw err
  }
}

export async function actualizarRecepcion(id: number, body: RecepcionUpdateInput, actualizadoPor: string) {
  const existente = await obtenerRecepcion(id)
  // Editable solo mientras no se haya procesado (compras.md §8: Cargada →
  // Validada). El motor de validación / generación de pallets aún no está
  // implementado, así que hoy toda Recepción vive en CARGADA — esta guarda
  // deja la puerta lista para cuando exista esa transición.
  if (existente.estado !== 'CARGADA') {
    throw new ValidationError('La Recepción ya fue procesada y no puede editarse')
  }
  // Un PATCH parcial no puede validarse aislado: si solo viene uno de los dos
  // campos, hay que evaluar la pareja efectiva contra lo persistido, no dejar
  // que quede una dirección de otra planta sin detectarlo (QAR-RCT-002).
  await validarPlantaYDireccion(
    body.plantaId ?? existente.plantaId,
    body.direccionPlantaId ?? existente.direccionPlantaId,
  )
  await validarTemplateCarga(body.templateCargaId)
  return repo.updateRecepcion(id, body, actualizadoPor)
}

export async function eliminarRecepcion(id: number, eliminadoPor: string) {
  const existente = await obtenerRecepcion(id)
  if (existente.estado !== 'CARGADA') {
    throw new ValidationError('La Recepción ya fue procesada y no puede eliminarse')
  }
  await repo.softDeleteRecepcion(id, eliminadoPor)
}

// ─── Adjuntos ──────────────────────────────────────────────────────────────

export async function subirAdjunto(
  recepcionId: number,
  archivo: { nombre: string; mime: string; datos: Buffer },
  userId: string,
) {
  const recepcion = await obtenerRecepcion(recepcionId)
  if (recepcion.estado !== 'CARGADA') {
    throw new ValidationError('La Recepción ya fue procesada y no admite nuevos adjuntos')
  }
  if (!MIMES_EXCEL_PERMITIDOS.has(archivo.mime)) {
    throw new ValidationError('Tipo de archivo no permitido. Se acepta solo Excel (.xls, .xlsx)')
  }
  if (archivo.datos.length > MAX_ADJUNTO_BYTES) {
    throw new ValidationError('El archivo supera el tamaño máximo de 10 MB')
  }

  return repo.createAdjunto(
    recepcionId,
    { nombre: archivo.nombre, mime: archivo.mime, tamano: archivo.datos.length },
    archivo.datos,
    userId,
  )
}

export async function descargarAdjunto(recepcionId: number, adjuntoId: number) {
  const meta = await repo.getAdjuntoMeta(recepcionId, adjuntoId)
  if (!meta) throw new NotFoundError('Adjunto', String(adjuntoId))
  const contenido = await repo.getAdjuntoContenido(adjuntoId)
  if (!contenido) throw new NotFoundError('Adjunto', String(adjuntoId))
  return { meta, datos: contenido.datos }
}

export async function eliminarAdjunto(recepcionId: number, adjuntoId: number) {
  const recepcion = await obtenerRecepcion(recepcionId)
  if (recepcion.estado !== 'CARGADA') {
    throw new ValidationError('La Recepción ya fue procesada y no admite eliminar adjuntos')
  }
  const meta = await repo.getAdjuntoMeta(recepcionId, adjuntoId)
  if (!meta) throw new NotFoundError('Adjunto', String(adjuntoId))
  await repo.deleteAdjunto(adjuntoId)
}
