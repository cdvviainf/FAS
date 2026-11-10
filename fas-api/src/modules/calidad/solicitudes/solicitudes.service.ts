import { NotFoundError, ValidationError, ConflictError, ForbiddenError } from '../../../shared/errors.js'
import { encolarCorreo, encolarCorreoDiferido, cancelarCorreoDiferido } from '../../correos/correos.queue.js'
import { enviarCorreo } from '../../../lib/mailer.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import type { ParCalidad } from '../../../shared/calidades-permitidas.js'
import * as repo from './solicitudes.repository.js'
import * as emails from './solicitudes.emails.js'
import type { SolicitudCreateBody, SolicitudUpdateBody, SolicitudCerrarBody, SolicitudCierreBorradorBody } from './solicitudes.schema.js'
import type { SolicitudListFilters, EtapaAdjunto } from './solicitudes.types.js'

const HORAS_RECORDATORIO = 24

// Tipo del detalle que retorna el repository (con includes)
type SolicitudDetalle = NonNullable<Awaited<ReturnType<typeof repo.getSolicitudById>>>

// APROBADA/RECHAZADA/OBJETADA son los tres estados terminales tras el cierre
// (OBJETADA agregada 2026-08-10) — CERRADA queda obsoleto (ver schema.prisma).
function estaCerrada(estado: string): boolean {
  return estado === 'APROBADA' || estado === 'RECHAZADA' || estado === 'OBJETADA' || estado === 'MIXTO'
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
  // Sin fecha de visita (2026-10-13: ya no se fija al crear) no hay nada que
  // recordar — se cancela cualquier recordatorio previo y se sale.
  if (!solicitud.fechaHora) {
    await cancelarCorreoDiferido(recordatorioJobId(solicitud.id))
    return
  }
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

// Validación de CABECERA (2026-10-27): especie/variedad/calibre/categoría/
// embalaje/calidades se movieron a la línea (ver validarLineas). Países/mercado
// siguen en cabecera.
async function validarReferencias(data: {
  usuarioSolicitanteId?: string
  entidadProductorId?: number
  plantaId?: number | null
  direccionId?: number
  contactoId?: number | null
  mercadoId?: number | null
  clienteId?: number | null
  paisIds?: number[]
  asignados?: { usuarioId: string; funcion: string }[]
}, entidadIdParaDireccion?: number, mercadoIdVigente?: number | null, paisIdsVigente?: number[]) {
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
  if (data.mercadoId != null) {
    const mercado = await repo.getMercadoActivo(data.mercadoId)
    if (!mercado) throw new ValidationError('El mercado seleccionado no existe o está bloqueado')
  }
  if (data.clienteId != null) {
    const cliente = await repo.getClienteExtranjero(data.clienteId)
    if (!cliente) throw new ValidationError('El cliente seleccionado no existe, está inactivo o no es de tipo Cliente Extranjero')
  }
  if (data.plantaId != null) {
    const planta = await repo.getEntidadPlanta(data.plantaId)
    if (!planta) throw new ValidationError('La planta seleccionada no existe, está inactiva/eliminada o no es de tipo Planta')
  }
  // mercadoId efectivo + paisIds efectivos: si el PATCH no toca países, se
  // revalidan los vigentes contra el mercado nuevo (QAS-SI-020).
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

// Validación de LÍNEAS (2026-10-27): por cada línea, especie activa; variedad +
// embalaje (1 c/u) y categorías/calibres/calidades (varios) válidos y
// pertenecientes a la especie de SU línea.
async function validarLineas(lineas: { especieId: number; articuloId: number; variedadId: number; categoriaIds?: number[]; calibreIds?: number[]; calidadesPermitidas?: ParCalidad[] }[]) {
  for (const [i, linea] of lineas.entries()) {
    const prefijo = `Línea ${i + 1}:`
    const especie = await repo.getEspecieActiva(linea.especieId)
    if (!especie) throw new ValidationError(`${prefijo} la especie seleccionada no existe o fue eliminada`)

    const [variedad] = await repo.getVariedadesActivas([linea.variedadId])
    if (!variedad) throw new ValidationError(`${prefijo} la variedad no existe o está bloqueada`)
    if (variedad.especieId !== linea.especieId) throw new ValidationError(`${prefijo} la variedad no pertenece a la especie`)

    const [articulo] = await repo.getArticulosEmbalaje([linea.articuloId])
    if (!articulo) throw new ValidationError(`${prefijo} el embalaje no existe`)
    if (articulo.tipo !== 'EMBALAJE') throw new ValidationError(`${prefijo} el embalaje debe ser un artículo de tipo Embalaje`)
    if (!articulo.activo) throw new ValidationError(`${prefijo} el embalaje está inactivo`)
    // El embalaje debe ser de la especie de la línea o genérico (sin especie).
    if (articulo.especieId != null && articulo.especieId !== linea.especieId) {
      throw new ValidationError(`${prefijo} el embalaje no pertenece a la especie`)
    }

    if (linea.categoriaIds && linea.categoriaIds.length > 0) {
      const categorias = await repo.getCategoriasActivas(linea.categoriaIds)
      if (categorias.length !== new Set(linea.categoriaIds).size) throw new ValidationError(`${prefijo} una o más categorías no existen o están bloqueadas`)
      if (categorias.some((c) => c.especieId !== linea.especieId)) throw new ValidationError(`${prefijo} una o más categorías no pertenecen a la especie`)
    }
    if (linea.calibreIds && linea.calibreIds.length > 0) {
      const calibres = await repo.getCalibresActivos(linea.calibreIds)
      if (calibres.length !== new Set(linea.calibreIds).size) throw new ValidationError(`${prefijo} uno o más calibres no existen o están bloqueados`)
      if (calibres.some((c) => c.especieId !== linea.especieId)) throw new ValidationError(`${prefijo} uno o más calibres no pertenecen a la especie`)
    }
    if (linea.calidadesPermitidas && linea.calidadesPermitidas.length > 0) {
      const clavesPar = new Set<string>()
      for (const p of linea.calidadesPermitidas) {
        const clave = `${p.notaCalidadId}-${p.notaCondicionId}`
        if (clavesPar.has(clave)) throw new ValidationError(`${prefijo} hay calidades permitidas repetidas (misma Calidad + Condición)`)
        clavesPar.add(clave)
      }
      const calidadIds = [...new Set(linea.calidadesPermitidas.map((p) => p.notaCalidadId))]
      const condicionIds = [...new Set(linea.calidadesPermitidas.map((p) => p.notaCondicionId))]
      const [calidades, condiciones] = await Promise.all([
        repo.getNotasCalidadActivas(calidadIds),
        repo.getNotasCondicionActivas(condicionIds),
      ])
      if (calidades.length !== calidadIds.length) throw new ValidationError(`${prefijo} una o más Notas de Calidad no existen o están bloqueadas`)
      if (condiciones.length !== condicionIds.length) throw new ValidationError(`${prefijo} una o más Notas de Condición no existen o están bloqueadas`)
      if (calidades.some((n) => !n.especies.some((e) => e.especieId === linea.especieId))) throw new ValidationError(`${prefijo} una o más Notas de Calidad no pertenecen a la especie`)
      if (condiciones.some((n) => !n.especies.some((e) => e.especieId === linea.especieId))) throw new ValidationError(`${prefijo} una o más Notas de Condición no pertenecen a la especie`)
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
  await validarReferencias({
    usuarioSolicitanteId,
    entidadProductorId: body.entidadProductorId,
    plantaId: body.plantaId,
    direccionId: body.direccionId,
    contactoId: body.contactoId,
    mercadoId: body.mercadoId,
    clienteId: body.clienteId,
    paisIds: body.paisIds,
    asignados: body.asignados,
  })
  // Mínimo una línea (defensa en profundidad: el zod del controller ya lo exige,
  // pero el service también se invoca directo, ej. tests/integración).
  if (body.lineas.length === 0) throw new ValidationError('Debe agregar al menos una línea de producto')
  await validarLineas(body.lineas)

  const { temporadaId, asignados, fechaHora, paisIds = [], lineas, ...core } = body
  return repo.createSolicitud(
    temporadaId,
    temporada.codigo,
    { ...core, usuarioSolicitanteId, fechaHora: fechaHora ? new Date(fechaHora) : null, fechaDespacho: core.fechaDespacho ? new Date(core.fechaDespacho) : null },
    { paisIds, lineas: lineas.map(normalizarLinea) },
    asignados,
    userId,
  )
}

// Normaliza una línea del body (campos opcionales con default []) al input del
// repository.
function normalizarLinea(l: SolicitudCreateBody['lineas'][number]): repo.SolicitudLineaInput {
  return {
    especieId: l.especieId,
    articuloId: l.articuloId,
    variedadId: l.variedadId,
    categoriaIds: l.categoriaIds ?? [],
    calibreIds: l.calibreIds ?? [],
    calidadesPermitidas: l.calidadesPermitidas ?? [],
    cantidadPallets: l.cantidadPallets ?? null,
  }
}

export async function actualizarSolicitud(id: number, body: SolicitudUpdateBody, userId: string) {
  const actual = await obtenerSolicitud(id)
  if (estaCerrada(actual.estado)) {
    throw new ConflictError('No se puede editar una solicitud cerrada')
  }

  await validarReferencias(
    {
      usuarioSolicitanteId: body.usuarioSolicitanteId,
      entidadProductorId: body.entidadProductorId,
      plantaId: body.plantaId,
      direccionId: body.direccionId,
      contactoId: body.contactoId,
      mercadoId: body.mercadoId,
      clienteId: body.clienteId,
      paisIds: body.paisIds,
      asignados: body.asignados,
    },
    body.entidadProductorId ?? actual.entidadProductorId,
    actual.mercadoId,
    actual.paises.map((p) => p.pais.id),
  )
  if (body.lineas !== undefined) {
    if (body.lineas.length === 0) throw new ValidationError('La solicitud debe mantener al menos una línea de producto')
    await validarLineas(body.lineas)
  }

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

  const { asignados, fechaHora, fechaDespacho, paisIds, lineas, ...core } = body
  const actualizada = await repo.updateSolicitud(
    id,
    {
      ...core,
      // null limpia la visita (y cancela el recordatorio); undefined = no tocar.
      ...(fechaHora !== undefined ? { fechaHora: fechaHora ? new Date(fechaHora) : null } : {}),
      ...(fechaDespacho !== undefined ? { fechaDespacho: fechaDespacho ? new Date(fechaDespacho) : null } : {}),
    },
    asignados,
    { paisIds, lineas: lineas?.map(normalizarLinea) },
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
  // Adjunta el PDF de la Solicitud de Inspección (se regenera en el worker).
  await encolarCorreo({
    to: await destinatariosDe(notificada),
    subject,
    html,
    empresaId: getEmpresaIdActual(),
    pdf: { tipo: 'solicitud-inspeccion', id: notificada.id },
  })
  await programarRecordatorio(notificada)
  return notificada
}

// Valida las líneas de defecto del cierre contra una especie (null = sin filtro
// por especie, p.ej. solicitudes legacy sin líneas). Reutilizado por el flujo por
// línea y el legacy de cabecera.
async function validarDefectosCierre(
  defectos: { grupoDefectoId: number; defectoId: number; valor: number }[],
  especieId: number | null,
  prefBase: string,
): Promise<void> {
  for (const [i, d] of defectos.entries()) {
    const prefijo = `${prefBase}defecto ${i + 1}:`
    const grupo = await repo.getGrupoDefectoActivo(d.grupoDefectoId)
    if (!grupo) throw new ValidationError(`${prefijo} el grupo seleccionado no existe o está bloqueado`)
    const defecto = await repo.getDefectoActivo(d.defectoId)
    if (!defecto) throw new ValidationError(`${prefijo} el defecto seleccionado no existe o está bloqueado`)
    if (defecto.grupoDefectoId !== d.grupoDefectoId) throw new ValidationError(`${prefijo} el defecto no pertenece al grupo seleccionado`)
    if (especieId != null && defecto.especies.length > 0 && !defecto.especies.some((e) => e.especieId === especieId)) {
      throw new ValidationError(`${prefijo} el defecto no es válido para la especie`)
    }
    if (defecto.tipoMedida === 'PORCENTAJE') {
      if (d.valor > 100) throw new ValidationError(`${prefijo} el porcentaje no puede superar 100`)
    } else if (!Number.isInteger(d.valor)) {
      throw new ValidationError(`${prefijo} el valor por unidades debe ser un número entero`)
    }
  }
}

// Valida + normaliza las características de madurez del cierre contra una especie
// (null = sin filtro). Devuelve solo la columna relevante según tipoDato (CM-007).
async function normalizarMadurezCierre(
  cs: { caracteristicaId: number; valorNumerico?: number | null; valorTexto?: string | null }[],
  especieId: number | null,
  prefBase: string,
): Promise<{ caracteristicaId: number; valorNumerico: number | null; valorTexto: string | null }[]> {
  const out: { caracteristicaId: number; valorNumerico: number | null; valorTexto: string | null }[] = []
  for (const [i, c] of cs.entries()) {
    const prefijo = `${prefBase}indicador de madurez ${i + 1}:`
    const caracteristica = await repo.getCaracteristicaMadurezActiva(c.caracteristicaId)
    if (!caracteristica) throw new ValidationError(`${prefijo} el indicador seleccionado no existe o está bloqueado`)
    if (especieId != null && caracteristica.especies.length > 0 && !caracteristica.especies.some((e) => e.especieId === especieId)) {
      throw new ValidationError(`${prefijo} el indicador no es válido para la especie`)
    }
    if (caracteristica.tipoDato === 'TEXTO') {
      if (c.valorTexto == null || c.valorTexto.trim() === '') throw new ValidationError(`${prefijo} debe registrar un valor de texto`)
      out.push({ caracteristicaId: c.caracteristicaId, valorNumerico: null, valorTexto: c.valorTexto.trim() })
    } else {
      if (c.valorNumerico == null) throw new ValidationError(`${prefijo} debe registrar un valor numérico`)
      if (caracteristica.tipoDato === 'ENTERO' && !Number.isInteger(c.valorNumerico)) throw new ValidationError(`${prefijo} el valor debe ser un número entero`)
      if (caracteristica.tipoDato === 'PORCENTAJE' && c.valorNumerico > 100) throw new ValidationError(`${prefijo} el porcentaje no puede superar 100`)
      out.push({ caracteristicaId: c.caracteristicaId, valorNumerico: c.valorNumerico, valorTexto: null })
    }
  }
  return out
}

// Quién puede registrar/cerrar la inspección: asignado ACUDIR o nivel TOTAL.
function requireInspectorOTotal(solicitud: SolicitudDetalle, userId: string, tieneNivelTotal: boolean, accion: string) {
  const esInspector = solicitud.asignados.some((a) => a.usuarioId === userId && a.funcion === 'ACUDIR')
  if (!esInspector && !tieneNivelTotal) {
    throw new ForbiddenError(`Solo un asignado con función Acudir (o un usuario con acceso total) puede ${accion} la inspección`)
  }
}

function requireNotificada(solicitud: SolicitudDetalle) {
  if (estaCerrada(solicitud.estado)) throw new ConflictError('La solicitud ya está cerrada')
  if (solicitud.estado !== 'NOTIFICADA') {
    throw new ConflictError('La solicitud debe estar notificada antes de registrar o cerrar la inspección')
  }
}

// "Editar inspección" (2026-11-10): guarda los datos de la visita sin cerrar.
// Sin correo; la solicitud sigue NOTIFICADA. Los NOTIFICAR son una lista fija:
// se conservan tal cual. Quién asiste (ACUDIR): los ya asignados se conservan;
// los NUEVOS deben tener el permiso de usuario "Inspector Calidad".
export async function guardarCierreBorrador(
  id: number,
  body: SolicitudCierreBorradorBody,
  userId: string,
  tieneNivelTotal: boolean,
) {
  const solicitud = await obtenerSolicitud(id)
  requireNotificada(solicitud)
  requireInspectorOTotal(solicitud, userId, tieneNivelTotal, 'registrar')

  const notificar = solicitud.asignados.filter((a) => a.funcion === 'NOTIFICAR')
  const notificarIds = new Set(notificar.map((a) => a.usuarioId))
  const acudeActuales = new Set(solicitud.asignados.filter((a) => a.funcion === 'ACUDIR').map((a) => a.usuarioId))
  if (body.acudeIds.some((u) => notificarIds.has(u))) {
    throw new ValidationError('Un usuario notificado no puede registrarse como asistente: las listas no se mezclan')
  }
  const nuevos = body.acudeIds.filter((u) => !acudeActuales.has(u))
  const inspectores = await repo.getInspectoresCalidad(nuevos)
  if (inspectores.length !== nuevos.length) {
    throw new ValidationError('Solo usuarios con el permiso Inspector Calidad pueden registrarse como asistentes')
  }
  const asignados = [
    ...body.acudeIds.map((usuarioId) => ({ usuarioId, funcion: 'ACUDIR' as const })),
    ...notificar.map((a) => ({ usuarioId: a.usuarioId, funcion: 'NOTIFICAR' as const })),
  ]
  // Usuarios activos + con email (misma regla que creación/edición).
  if (asignados.length > 0) await validarReferencias({ asignados })

  let extra: Pick<repo.CierreBorradorData, 'lineas' | 'defectosCabecera' | 'caracteristicasCabecera'>
  if (solicitud.lineas.length > 0) {
    const lineasSolicitud = new Map(solicitud.lineas.map((l) => [l.id, l]))
    const enviadas = new Map((body.lineas ?? []).map((l) => [l.solicitudLineaId, l]))
    for (const l of body.lineas ?? []) {
      if (!lineasSolicitud.has(l.solicitudLineaId)) throw new ValidationError('Una de las líneas no pertenece a la solicitud')
    }
    const lineas: repo.CierreLineaData[] = []
    for (const [idx, linea] of solicitud.lineas.entries()) {
      const enviada = enviadas.get(linea.id)
      const defectos = enviada?.defectos ?? []
      await validarDefectosCierre(defectos, linea.especie.id, `Línea ${idx + 1}: `)
      const caracteristicas = await normalizarMadurezCierre(enviada?.caracteristicas ?? [], linea.especie.id, `Línea ${idx + 1}: `)
      lineas.push({ solicitudLineaId: linea.id, veredicto: enviada?.veredicto ?? null, defectos, caracteristicas })
    }
    extra = { lineas }
  } else {
    await validarDefectosCierre(body.defectos ?? [], null, '')
    const caracteristicasCabecera = await normalizarMadurezCierre(body.caracteristicas ?? [], null, '')
    extra = { defectosCabecera: body.defectos ?? [], caracteristicasCabecera }
  }

  return repo.guardarCierreBorrador(
    id,
    {
      comentarios: body.comentarios?.trim() || null,
      fechaHora: body.fechaHora !== undefined ? (body.fechaHora ? new Date(body.fechaHora) : null) : undefined,
      servicioTercero: body.servicioTercero?.trim() || null,
      asignados,
      ...extra,
    },
    userId,
  )
}

// Completitud para cerrar (sobre lo guardado) → resultado de la cabecera.
// Lanza ValidationError indicando qué falta completar en "Editar inspección".
function resultadoCierre(solicitud: SolicitudDetalle, body: SolicitudCerrarBody): 'APROBADA' | 'RECHAZADA' | 'OBJETADA' | 'MIXTO' {
  const faltantes: string[] = []
  if (!solicitud.comentariosCierre?.trim()) faltantes.push('los comentarios')
  if (!solicitud.fechaHora) faltantes.push('la fecha y hora de la visita')
  if (!solicitud.asignados.some((a) => a.funcion === 'ACUDIR') && !solicitud.servicioTercero?.trim()) {
    faltantes.push('quién asiste (un inspector o un Servicio Tercero)')
  }
  let resultado: 'APROBADA' | 'RECHAZADA' | 'OBJETADA' | 'MIXTO' | null = null
  if (solicitud.lineas.length > 0) {
    const veredictos = solicitud.lineas.map((l) => l.estadoCierre)
    if (veredictos.some((v) => v !== 'APROBADA' && v !== 'RECHAZADA' && v !== 'OBJETADA')) {
      faltantes.push('el veredicto de todas las líneas')
    } else {
      const todas = (v: string) => veredictos.every((x) => x === v)
      resultado = todas('APROBADA') ? 'APROBADA' : todas('RECHAZADA') ? 'RECHAZADA' : todas('OBJETADA') ? 'OBJETADA' : 'MIXTO'
    }
  } else if (body.resultado) {
    resultado = body.resultado
  } else {
    faltantes.push('el resultado de la inspección')
  }
  if (faltantes.length > 0 || !resultado) {
    throw new ValidationError(`No se puede cerrar: falta ${faltantes.join(', ')}. Complétalo con "Editar inspección" y guarda.`)
  }
  return resultado
}

// "Cerrar inspección" (2026-11-10): solo cambia el estado con lo ya guardado en
// "Editar inspección". Valida completitud: comentarios, fecha de visita, quién
// asiste (≥1 inspector o Servicio Tercero) y veredicto en todas las líneas (o
// `resultado` de cabecera en solicitudes legacy sin líneas). Envía el correo.
export async function cerrarSolicitud(
  id: number,
  body: SolicitudCerrarBody,
  userId: string,
  tieneNivelTotal: boolean,
) {
  // Chequeo temprano (404/permiso) fuera de la transacción; la validación
  // definitiva se repite sobre la fila bloqueada (CIG-001).
  const previa = await obtenerSolicitud(id)
  requireNotificada(previa)
  requireInspectorOTotal(previa, userId, tieneNivelTotal, 'cerrar')

  const cerrada = await repo.cerrarConValidacion(id, userId, (solicitud) => {
    requireNotificada(solicitud as SolicitudDetalle)
    requireInspectorOTotal(solicitud as SolicitudDetalle, userId, tieneNivelTotal, 'cerrar')
    return resultadoCierre(solicitud as SolicitudDetalle, body)
  })
  const resultado = cerrada.estado as 'APROBADA' | 'RECHAZADA' | 'OBJETADA' | 'MIXTO'
  await cancelarCorreoDiferido(recordatorioJobId(id))

  const adjuntosCierre = cerrada.adjuntos.filter((a) => a.etapa === 'CIERRE').length
  const comentarios = cerrada.comentariosCierre ?? ''
  const { subject, html } = emails.correoCierre(cerrada, comentarios, adjuntosCierre, resultado)
  await encolarCorreo({ to: await destinatariosDe(cerrada), subject, html, empresaId: getEmpresaIdActual() })

  return cerrada
}

// Opciones de "Quién asiste": usuarios con el permiso Inspector Calidad.
export async function listarInspectoresCalidad() {
  return repo.listInspectoresCalidad()
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
