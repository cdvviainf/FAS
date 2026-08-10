import { NotFoundError, ValidationError, ConflictError, ForbiddenError } from '../../../shared/errors.js'
import { encolarCorreo, encolarCorreoDiferido, cancelarCorreoDiferido } from '../../correos/correos.queue.js'
import { enviarCorreo } from '../../../lib/mailer.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import * as repo from './solicitudes.repository.js'
import * as emails from './solicitudes.emails.js'
import type { SolicitudCreateBody, SolicitudUpdateBody, SolicitudCerrarBody } from './solicitudes.schema.js'
import type { SolicitudListFilters, EtapaAdjunto } from './solicitudes.types.js'

const HORAS_RECORDATORIO = 24

// Tipo del detalle que retorna el repository (con includes)
type SolicitudDetalle = NonNullable<Awaited<ReturnType<typeof repo.getSolicitudById>>>

// APROBADA/RECHAZADA/OBJETADA son los tres estados terminales tras el cierre
// (OBJETADA agregada 2026-08-10) — CERRADA queda obsoleto (ver schema.prisma).
function estaCerrada(estado: string): boolean {
  return estado === 'APROBADA' || estado === 'RECHAZADA' || estado === 'OBJETADA'
}

// ─── Helpers de correo ───────────────────────────────────────────────────────

/** Emails únicos de asignados + solicitante. */
async function destinatariosDe(solicitud: SolicitudDetalle): Promise<string[]> {
  const correos = solicitud.asignados.map((a) => a.usuario.email)
  if (solicitud.usuarioSolicitante?.email) correos.push(solicitud.usuarioSolicitante.email)
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
    { solicitudId: solicitud.id, empresaId: getEmpresaIdActual() },
    delay,
  )
}

/**
 * Procesa el job diferido de recordatorio (lo invoca el worker de correos).
 * Construye el correo al momento del envío para reflejar datos vigentes.
 */
export async function procesarRecordatorio(solicitudId: number) {
  const solicitud = await repo.getSolicitudById(solicitudId)
  if (!solicitud || estaCerrada(solicitud.estado)) return
  const { subject, html } = emails.correoRecordatorio(solicitud)
  await enviarCorreo({ to: await destinatariosDe(solicitud), subject, html })
  await repo.marcarRecordatorioEnviado(solicitudId)
}

// ─── Validaciones comunes ────────────────────────────────────────────────────

async function validarReferencias(data: {
  usuarioSolicitanteId?: string
  entidadProductorId?: number
  direccionId?: number
  contactoId?: number | null
  especieId?: number | null
  mercadoId?: number | null
  clienteId?: number | null
  calificacionId?: number | null
  paisIds?: number[]
  variedadIds?: number[]
  calibreIds?: number[]
  categoriaIds?: number[]
  articuloIds?: number[]
  asignados?: { usuarioId: string; funcion: string }[]
}, entidadIdParaDireccion?: number, especieIdVigente?: number | null, mercadoIdVigente?: number | null, paisIdsVigente?: number[]) {
  if (data.usuarioSolicitanteId !== undefined) {
    const solicitante = await repo.getUsuarioById(data.usuarioSolicitanteId)
    if (!solicitante) throw new ValidationError('El solicitante seleccionado no existe o fue eliminado')
  }
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
  if (data.especieId != null) {
    const especie = await repo.getEspecieActiva(data.especieId)
    if (!especie) throw new ValidationError('La especie seleccionada no existe o fue eliminada')
  }
  if (data.mercadoId != null) {
    const mercado = await repo.getMercadoActivo(data.mercadoId)
    if (!mercado) throw new ValidationError('El mercado seleccionado no existe o está bloqueado')
  }
  if (data.clienteId != null) {
    const cliente = await repo.getClienteExtranjero(data.clienteId)
    if (!cliente) throw new ValidationError('El cliente seleccionado no existe, está inactivo o no es de tipo Cliente Extranjero')
  }
  if (data.calificacionId != null) {
    const calificacion = await repo.getCalificacionActiva(data.calificacionId)
    if (!calificacion) throw new ValidationError('La calificación seleccionada no existe o está bloqueada')
  }

  // especieId/mercadoId efectivos (valor nuevo si viene en el body, si no el vigente)
  // para validar pertenencia de variedad/calibre/categoría/país aunque solo uno
  // de los dos campos relacionados cambie (QAS-SI-020). paisIds efectivo: si el
  // PATCH no toca países, se revalidan los vigentes contra el mercado nuevo —
  // si no, un cambio de mercado sin tocar países deja la solicitud incoherente.
  const especieId = data.especieId !== undefined ? data.especieId : especieIdVigente
  const mercadoId = data.mercadoId !== undefined ? data.mercadoId : mercadoIdVigente
  const paisIdsEfectivos = data.paisIds !== undefined ? data.paisIds : paisIdsVigente

  if (paisIdsEfectivos && paisIdsEfectivos.length > 0) {
    if (mercadoId == null) {
      throw new ValidationError('No se pueden seleccionar países sin definir un mercado')
    }
    const paises = await repo.getPaisesActivos(paisIdsEfectivos)
    const cantidadUnica = new Set(paisIdsEfectivos).size
    if (paises.length !== cantidadUnica) {
      throw new ValidationError('Uno o más países seleccionados no existen o están bloqueados')
    }
    const enMercado = await repo.contarPaisesEnMercado(paisIdsEfectivos, mercadoId)
    if (enMercado !== cantidadUnica) {
      throw new ValidationError('Uno o más países seleccionados no pertenecen al mercado indicado')
    }
  }
  if (data.variedadIds && data.variedadIds.length > 0) {
    const variedades = await repo.getVariedadesActivas(data.variedadIds)
    if (variedades.length !== new Set(data.variedadIds).size) {
      throw new ValidationError('Una o más variedades seleccionadas no existen o están bloqueadas')
    }
    if (especieId != null && variedades.some((v) => v.especieId !== especieId)) {
      throw new ValidationError('Una o más variedades no pertenecen a la especie seleccionada')
    }
  }
  if (data.calibreIds && data.calibreIds.length > 0) {
    const calibres = await repo.getCalibresActivos(data.calibreIds)
    if (calibres.length !== new Set(data.calibreIds).size) {
      throw new ValidationError('Uno o más calibres seleccionados no existen o están bloqueados')
    }
    if (especieId != null && calibres.some((c) => c.especieId !== especieId)) {
      throw new ValidationError('Uno o más calibres no pertenecen a la especie seleccionada')
    }
  }
  if (data.categoriaIds && data.categoriaIds.length > 0) {
    const categorias = await repo.getCategoriasActivas(data.categoriaIds)
    if (categorias.length !== new Set(data.categoriaIds).size) {
      throw new ValidationError('Una o más categorías seleccionadas no existen o están bloqueadas')
    }
    if (especieId != null && categorias.some((c) => c.especieId !== especieId)) {
      throw new ValidationError('Una o más categorías no pertenecen a la especie seleccionada')
    }
  }
  if (data.articuloIds && data.articuloIds.length > 0) {
    const articulos = await repo.getArticulosEmbalaje(data.articuloIds)
    if (articulos.length !== new Set(data.articuloIds).size) {
      throw new ValidationError('Uno o más embalajes seleccionados no existen')
    }
    if (articulos.some((a) => a.tipo !== 'EMBALAJE')) {
      throw new ValidationError('Todos los embalajes seleccionados deben ser artículos de tipo Embalaje')
    }
    if (articulos.some((a) => !a.activo)) {
      throw new ValidationError('Uno o más embalajes seleccionados están inactivos')
    }
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

  // Si se omite, el solicitante por defecto es el usuario autenticado —
  // igual que ya hace la UI, pero también para cualquier otro consumidor de
  // la API (QA-R2-SI-001). Sigue siendo editable a otro usuario.
  const usuarioSolicitanteId = body.usuarioSolicitanteId ?? userId
  await validarReferencias({ ...body, usuarioSolicitanteId })

  const {
    temporadaId, asignados, fechaHora,
    paisIds = [], variedadIds = [], calibreIds = [], categoriaIds = [], articuloIds = [],
    ...core
  } = body
  return repo.createSolicitud(
    temporadaId,
    temporada.codigo,
    { ...core, usuarioSolicitanteId, fechaHora: new Date(fechaHora), fechaDespacho: core.fechaDespacho ? new Date(core.fechaDespacho) : null },
    { paisIds, variedadIds, calibreIds, categoriaIds, articuloIds },
    asignados,
    userId,
  )
}

export async function actualizarSolicitud(id: number, body: SolicitudUpdateBody, userId: string) {
  const actual = await obtenerSolicitud(id)
  if (estaCerrada(actual.estado)) {
    throw new ConflictError('No se puede editar una solicitud cerrada')
  }

  await validarReferencias(
    body,
    body.entidadProductorId ?? actual.entidadProductorId,
    actual.especieId,
    actual.mercadoId,
    actual.paises.map((p) => p.pais.id),
  )

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

  const { asignados, fechaHora, fechaDespacho, paisIds, variedadIds, calibreIds, categoriaIds, articuloIds, ...core } = body
  const actualizada = await repo.updateSolicitud(
    id,
    {
      ...core,
      ...(fechaHora ? { fechaHora: new Date(fechaHora) } : {}),
      ...(fechaDespacho !== undefined ? { fechaDespacho: fechaDespacho ? new Date(fechaDespacho) : null } : {}),
    },
    asignados,
    { paisIds, variedadIds, calibreIds, categoriaIds, articuloIds },
    userId,
  )

  // Si ya estaba notificada: avisar el cambio (a asignados previos + vigentes) y reprogramar
  if (actual.estado === 'NOTIFICADA') {
    const destinatarios = [...new Set([...destinatariosPrevios, ...(await destinatariosDe(actualizada))])]
    const { subject, html } = emails.correoModificacion(actualizada)
    await encolarCorreo({ to: destinatarios, subject, html, empresaId: getEmpresaIdActual() })
    await programarRecordatorio(actualizada)
  }

  return actualizada
}

export async function eliminarSolicitud(id: number, userId: string) {
  const actual = await obtenerSolicitud(id)
  if (estaCerrada(actual.estado)) {
    throw new ConflictError('No se puede eliminar una solicitud cerrada')
  }

  await repo.softDeleteSolicitud(id, userId)
  await cancelarCorreoDiferido(recordatorioJobId(id))

  // Si estaba notificada: avisar la eliminación
  if (actual.estado === 'NOTIFICADA') {
    const { subject, html } = emails.correoEliminacion(actual)
    await encolarCorreo({ to: await destinatariosDe(actual), subject, html, empresaId: getEmpresaIdActual() })
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
  await encolarCorreo({ to: await destinatariosDe(notificada), subject, html, empresaId: getEmpresaIdActual() })
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
  if (estaCerrada(solicitud.estado)) {
    throw new ConflictError('La solicitud ya está cerrada')
  }
  if (solicitud.estado !== 'NOTIFICADA') {
    throw new ConflictError('La solicitud debe estar notificada antes de poder cerrarse')
  }

  const esInspector = solicitud.asignados.some((a) => a.usuarioId === userId && a.funcion === 'ACUDIR')
  if (!esInspector && !tieneNivelTotal) {
    throw new ForbiddenError('Solo un asignado con función Acudir (o un usuario con acceso total) puede cerrar la inspección')
  }

  const cerrada = await repo.cerrarSolicitud(id, body.comentarios, body.resultado, userId)
  await cancelarCorreoDiferido(recordatorioJobId(id))

  const adjuntosCierre = cerrada.adjuntos.filter((a) => a.etapa === 'CIERRE').length
  const { subject, html } = emails.correoCierre(cerrada, body.comentarios, adjuntosCierre, body.resultado)
  await encolarCorreo({ to: await destinatariosDe(cerrada), subject, html, empresaId: getEmpresaIdActual() })

  return cerrada
}

export async function reabrirSolicitud(id: number, userId: string) {
  const solicitud = await obtenerSolicitud(id)
  if (!estaCerrada(solicitud.estado)) {
    throw new ConflictError('Solo se puede reabrir una solicitud cerrada')
  }

  const reabierta = await repo.reabrirSolicitud(id, userId)
  await programarRecordatorio(reabierta)

  const { subject, html } = emails.correoReapertura(reabierta)
  await encolarCorreo({ to: await destinatariosDe(reabierta), subject, html, empresaId: getEmpresaIdActual() })

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
    solicitud.usuarioSolicitanteId === userId || solicitud.asignados.some((a) => a.usuarioId === userId)
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
  // y después de aprobada/rechazada la solicitud queda congelada.
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
