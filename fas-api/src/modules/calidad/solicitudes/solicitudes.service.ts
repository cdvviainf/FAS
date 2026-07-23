import { NotFoundError, ValidationError, ConflictError, ForbiddenError } from '../../../shared/errors.js'
import { encolarCorreo, encolarCorreoDiferido, cancelarCorreoDiferido } from '../../correos/correos.queue.js'
import { enviarCorreo } from '../../../lib/mailer.js'
import * as repo from './solicitudes.repository.js'
import * as emails from './solicitudes.emails.js'
import type { SolicitudCreateBody, SolicitudUpdateBody, SolicitudCerrarBody } from './solicitudes.schema.js'
import type { SolicitudListFilters, EtapaAdjunto } from './solicitudes.types.js'

const HORAS_RECORDATORIO = 24

// Tipo del detalle que retorna el repository (con includes)
type SolicitudDetalle = NonNullable<Awaited<ReturnType<typeof repo.getSolicitudById>>>

// ─── Helpers de correo ───────────────────────────────────────────────────────

/** Emails únicos de asignados + solicitante. */
async function destinatariosDe(solicitud: SolicitudDetalle): Promise<string[]> {
  const correos = solicitud.asignados.map((a) => a.usuario.email)
  const solicitante = await repo.getUsuarioById(solicitud.creadoPor)
  if (solicitante?.email) correos.push(solicitante.email)
  return [...new Set(correos.filter(Boolean))]
}

function recordatorioJobId(solicitudId: number): string {
  return `recordatorio-si-${solicitudId}`
}

/** Programa (o reprograma) el recordatorio a HORAS_RECORDATORIO antes de la visita. */
async function programarRecordatorio(solicitud: SolicitudDetalle) {
  const disparo = solicitud.fechaHora.getTime() - HORAS_RECORDATORIO * 3_600_000
  const delay = disparo - Date.now()
  if (delay <= 0) {
    await cancelarCorreoDiferido(recordatorioJobId(solicitud.id))
    return
  }
  await encolarCorreoDiferido(
    recordatorioJobId(solicitud.id),
    { solicitudId: solicitud.id },
    delay,
  )
}

/**
 * Procesa el job diferido de recordatorio (lo invoca el worker de correos).
 * Construye el correo al momento del envío para reflejar datos vigentes.
 */
export async function procesarRecordatorio(solicitudId: number) {
  const solicitud = await repo.getSolicitudById(solicitudId)
  if (!solicitud || solicitud.estado === 'CERRADA') return
  const { subject, html } = emails.correoRecordatorio(solicitud)
  await enviarCorreo({ to: await destinatariosDe(solicitud), subject, html })
  await repo.marcarRecordatorioEnviado(solicitudId)
}

// ─── Validaciones comunes ────────────────────────────────────────────────────

async function validarReferencias(data: {
  entidadProductorId?: number
  direccionId?: number
  contactoId?: number | null
  motivoId?: number
  especieId?: number | null
  asignados?: { usuarioId: string; funcion: string }[]
}, entidadIdParaDireccion?: number) {
  if (data.entidadProductorId !== undefined) {
    const entidad = await repo.getEntidadProductor(data.entidadProductorId)
    if (!entidad) throw new ValidationError('La entidad seleccionada no existe, está inactiva/eliminada o no es de tipo Productor')
  }
  const entidadId = entidadIdParaDireccion ?? data.entidadProductorId
  if (data.direccionId !== undefined) {
    if (!entidadId) throw new ValidationError('No se puede validar la dirección sin entidad')
    const direccion = await repo.getDireccionDeEntidad(data.direccionId, entidadId)
    if (!direccion) throw new ValidationError('La dirección seleccionada no pertenece a la entidad productora o fue eliminada')
  }
  if (data.contactoId != null) {
    if (!entidadId) throw new ValidationError('No se puede validar el contacto sin entidad')
    const contacto = await repo.getContactoDeEntidad(data.contactoId, entidadId)
    if (!contacto) throw new ValidationError('El contacto seleccionado no pertenece a la entidad productora o fue eliminado')
  }
  if (data.motivoId !== undefined) {
    const motivo = await repo.getMotivoActivo(data.motivoId)
    if (!motivo) throw new ValidationError('El motivo seleccionado no existe, está bloqueado o fue eliminado')
  }
  if (data.especieId != null) {
    const especie = await repo.getEspecieActiva(data.especieId)
    if (!especie) throw new ValidationError('La especie seleccionada no existe o fue eliminada')
  }
  if (data.asignados !== undefined) {
    const ids = data.asignados.map((a) => a.usuarioId)
    const usuarios = await repo.getUsuariosActivos(ids)
    if (usuarios.length !== ids.length) {
      throw new ValidationError('Uno o más usuarios asignados no existen o fueron eliminados')
    }
    const sinEmail = usuarios.filter((u) => !u.email)
    if (sinEmail.length > 0) {
      throw new ValidationError(`Usuarios sin email registrado: ${sinEmail.map((u) => u.nombre).join(', ')}`)
    }
  }
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function listarSolicitudes(filters: SolicitudListFilters) {
  const { data, total } = await repo.listSolicitudes(filters)
  const { page = 1, limit = 20 } = filters
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function obtenerSolicitud(id: number) {
  const solicitud = await repo.getSolicitudById(id)
  if (!solicitud) throw new NotFoundError('Solicitud de inspección', String(id))
  return solicitud
}

export async function crearSolicitud(body: SolicitudCreateBody, userId: string) {
  const temporada = await repo.getTemporadaActiva(body.temporadaId)
  if (!temporada) throw new ValidationError('La temporada seleccionada no existe o fue eliminada')

  await validarReferencias(body)

  const { temporadaId, asignados, fechaHora, ...core } = body
  return repo.createSolicitud(
    temporadaId,
    temporada.codigo,
    { ...core, fechaHora: new Date(fechaHora) },
    asignados,
    userId,
  )
}

export async function actualizarSolicitud(id: number, body: SolicitudUpdateBody, userId: string) {
  const actual = await obtenerSolicitud(id)
  if (actual.estado === 'CERRADA') {
    throw new ConflictError('No se puede editar una solicitud cerrada')
  }

  await validarReferencias(body, body.entidadProductorId ?? actual.entidadProductorId)

  // Si cambia la entidad, la dirección debe venir también (y ya se validó contra la nueva entidad)
  const cambiaEntidad = body.entidadProductorId !== undefined && body.entidadProductorId !== actual.entidadProductorId
  if (cambiaEntidad && body.direccionId === undefined) {
    throw new ValidationError('Al cambiar el productor debe seleccionar una dirección de la nueva entidad')
  }
  // El contacto pertenece a la entidad: si cambia el productor y no se envía uno nuevo, se limpia
  if (cambiaEntidad && body.contactoId === undefined) {
    body.contactoId = null
  }

  // QAS-SI-012: capturar destinatarios previos ANTES de actualizar, para avisar
  // también a los asignados que puedan ser removidos en esta edición.
  const destinatariosPrevios = actual.estado === 'NOTIFICADA' ? await destinatariosDe(actual) : []

  const { asignados, fechaHora, ...core } = body
  const actualizada = await repo.updateSolicitud(
    id,
    { ...core, ...(fechaHora ? { fechaHora: new Date(fechaHora) } : {}) },
    asignados,
    userId,
  )

  // Si ya estaba notificada: avisar el cambio (a asignados previos + vigentes) y reprogramar
  if (actual.estado === 'NOTIFICADA') {
    const destinatarios = [...new Set([...destinatariosPrevios, ...(await destinatariosDe(actualizada))])]
    const { subject, html } = emails.correoModificacion(actualizada)
    await encolarCorreo({ to: destinatarios, subject, html })
    await programarRecordatorio(actualizada)
  }

  return actualizada
}

export async function eliminarSolicitud(id: number, userId: string) {
  const actual = await obtenerSolicitud(id)
  if (actual.estado === 'CERRADA') {
    throw new ConflictError('No se puede eliminar una solicitud cerrada')
  }

  await repo.softDeleteSolicitud(id, userId)
  await cancelarCorreoDiferido(recordatorioJobId(id))

  // Si estaba notificada: avisar la eliminación
  if (actual.estado === 'NOTIFICADA') {
    const { subject, html } = emails.correoEliminacion(actual)
    await encolarCorreo({ to: await destinatariosDe(actual), subject, html })
  }
}

// ─── Acciones de flujo ───────────────────────────────────────────────────────

export async function notificarSolicitud(id: number, userId: string) {
  const solicitud = await obtenerSolicitud(id)
  // QAS-SI-003: solo se notifica desde PENDIENTE. Para reenviar tras cambios,
  // la edición de una NOTIFICADA ya dispara el correo automáticamente.
  if (solicitud.estado !== 'PENDIENTE') {
    throw new ConflictError(
      solicitud.estado === 'NOTIFICADA'
        ? 'La solicitud ya fue notificada'
        : 'No se puede notificar una solicitud cerrada',
    )
  }

  // QAS-SI-013: la transición atómica va PRIMERO. Si otro request concurrente
  // ya notificó esta solicitud, `marcarNotificada` lanza 409 y no se encola
  // un segundo correo — solo el request que gana la transición notifica.
  const notificada = await repo.marcarNotificada(id, userId)

  const { subject, html } = emails.correoNotificacion(notificada)
  await encolarCorreo({ to: await destinatariosDe(notificada), subject, html })
  await programarRecordatorio(notificada)
  return notificada
}

export async function cerrarSolicitud(
  id: number,
  body: SolicitudCerrarBody,
  userId: string,
  tieneNivelTotal: boolean,
) {
  const solicitud = await obtenerSolicitud(id)
  // QAS-SI-003: solo se cierra una solicitud ya notificada.
  if (solicitud.estado === 'CERRADA') {
    throw new ConflictError('La solicitud ya está cerrada')
  }
  if (solicitud.estado !== 'NOTIFICADA') {
    throw new ConflictError('La solicitud debe estar notificada antes de poder cerrarse')
  }

  const esInspector = solicitud.asignados.some((a) => a.usuarioId === userId && a.funcion === 'ACUDIR')
  if (!esInspector && !tieneNivelTotal) {
    throw new ForbiddenError('Solo un asignado con función Acudir (o un usuario con acceso total) puede cerrar la inspección')
  }

  const cerrada = await repo.cerrarSolicitud(id, body.comentarios, userId)
  await cancelarCorreoDiferido(recordatorioJobId(id))

  const adjuntosCierre = cerrada.adjuntos.filter((a) => a.etapa === 'CIERRE').length
  const { subject, html } = emails.correoCierre(cerrada, body.comentarios, adjuntosCierre)
  await encolarCorreo({ to: await destinatariosDe(cerrada), subject, html })

  return cerrada
}

export async function reabrirSolicitud(id: number, userId: string) {
  const solicitud = await obtenerSolicitud(id)
  if (solicitud.estado !== 'CERRADA') {
    throw new ConflictError('Solo se puede reabrir una solicitud cerrada')
  }

  const reabierta = await repo.reabrirSolicitud(id, userId)
  await programarRecordatorio(reabierta)

  const { subject, html } = emails.correoReapertura(reabierta)
  await encolarCorreo({ to: await destinatariosDe(reabierta), subject, html })

  return reabierta
}

// ─── Adjuntos ────────────────────────────────────────────────────────────────

const MIMES_PERMITIDOS = new Set([
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
])

export const MAX_ADJUNTO_BYTES = 10 * 1024 * 1024 // 10 MB

/** Solo el solicitante, un asignado o un usuario con nivel TOTAL pueden tocar adjuntos. */
function validarInvolucrado(solicitud: SolicitudDetalle, userId: string, tieneNivelTotal: boolean) {
  const esInvolucrado =
    solicitud.creadoPor === userId || solicitud.asignados.some((a) => a.usuarioId === userId)
  if (!esInvolucrado && !tieneNivelTotal) {
    throw new ForbiddenError('Solo el solicitante o un asignado pueden gestionar los adjuntos de esta solicitud')
  }
}

export async function subirAdjunto(
  solicitudId: number,
  archivo: { nombre: string; mime: string; datos: Buffer },
  etapa: EtapaAdjunto,
  userId: string,
  tieneNivelTotal: boolean,
) {
  const solicitud = await obtenerSolicitud(solicitudId)
  validarInvolucrado(solicitud, userId, tieneNivelTotal)
  // Los adjuntos solo tienen sentido una vez notificada la visita (el inspector
  // los usa para respaldar la inspección en terreno); antes (PENDIENTE) no aplica,
  // y después de CERRADA la solicitud queda congelada.
  if (solicitud.estado !== 'NOTIFICADA') {
    throw new ConflictError('Los adjuntos solo pueden agregarse mientras la solicitud está notificada')
  }
  if (!MIMES_PERMITIDOS.has(archivo.mime)) {
    throw new ValidationError('Tipo de archivo no permitido. Se aceptan: PDF, Excel, Word e imágenes')
  }
  if (archivo.datos.length > MAX_ADJUNTO_BYTES) {
    throw new ValidationError('El archivo supera el tamaño máximo de 10 MB')
  }

  return repo.createAdjunto(
    solicitudId,
    { nombre: archivo.nombre, mime: archivo.mime, tamano: archivo.datos.length, etapa },
    archivo.datos,
    userId,
  )
}

export async function descargarAdjunto(solicitudId: number, adjuntoId: number) {
  await obtenerSolicitud(solicitudId)
  const meta = await repo.getAdjuntoMeta(solicitudId, adjuntoId)
  if (!meta) throw new NotFoundError('Adjunto', String(adjuntoId))
  const contenido = await repo.getAdjuntoContenido(adjuntoId)
  if (!contenido) throw new NotFoundError('Contenido de adjunto', String(adjuntoId))
  return { meta, datos: Buffer.from(contenido.datos) }
}

export async function eliminarAdjunto(solicitudId: number, adjuntoId: number, userId: string, tieneNivelTotal: boolean) {
  const solicitud = await obtenerSolicitud(solicitudId)
  validarInvolucrado(solicitud, userId, tieneNivelTotal)
  if (solicitud.estado !== 'NOTIFICADA') {
    throw new ConflictError('Los adjuntos solo pueden eliminarse mientras la solicitud está notificada')
  }
  const meta = await repo.getAdjuntoMeta(solicitudId, adjuntoId)
  if (!meta) throw new NotFoundError('Adjunto', String(adjuntoId))
  await repo.deleteAdjunto(adjuntoId)
}
