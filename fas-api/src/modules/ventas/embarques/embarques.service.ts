import type { TipoEntidad } from '@prisma/client'
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './embarques.repository.js'
import * as prefijosService from '../../config/prefijos-codigo/prefijos-codigo.service.js'
import * as aglAdapter from './agl360.adapter.js'
import * as integracionesRepo from '../../config/integraciones/integraciones.repository.js'
import * as templatesCargaRepo from '../../config/templates-carga/templates-carga.repository.js'
import { reconciliarPackingList } from './embarques.packing-list.motor.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import type { ResultadoIntentoReserva } from './embarques.repository.js'
import type { DatosReservaManualInput, DatosReservaBaseInput, DatosInstructivoInput, InstructivoHijoUpdateInput, EmbarqueCreateInput, DatosContenedorInput } from './embarques.types.js'
import type { AglWebhookConfirmarBody } from './embarques.schema.js'
import type { SolicitudAglPayload } from './agl360.adapter.js'

const CODIGO_INTEGRACION_AGL = 'AGL360'

// Resuelve el modo de reserva de un Gestor Logístico (2026-09-07, ventas.md
// §4.3 — generaliza el hardcode a AGL360): "automático" solo si tiene una
// Integración activa vinculada Y esa Integración tiene un adapter real. Hoy
// el único adapter real es AGL360 (agl360.adapter.ts) — un gestor vinculado
// a cualquier otro código, o sin Integración vinculada, cae a manual (YAGNI,
// mismo criterio que el adapter DTE en CLAUDE.md: no se construye un
// dispatcher genérico multi-adapter mientras solo exista uno).
async function resolverModoAutomatico(gestorLogisticoId: number): Promise<boolean> {
  const integracion = await integracionesRepo.getIntegracionActivaPorGestorLogistico(gestorLogisticoId)
  return integracion?.codigo === CODIGO_INTEGRACION_AGL
}

// Estado combinado del listado (2026-09-30): "efectivamente despachado" pisa
// al estado de reserva, mismo criterio que requireEmbarqueDespachado en
// cobranza/facturación (despachadoEn != null && despachoAnuladoEn == null).
function resolverEstadoListado(e: { estadoReserva: string; despachadoEn: Date | null; despachoAnuladoEn: Date | null }): string {
  if (e.despachadoEn != null) return e.despachoAnuladoEn != null ? 'DESPACHO_ANULADO' : 'DESPACHADO'
  return e.estadoReserva
}

export async function listarEmbarques(page: number, limit: number, notaVentaId?: number, estado?: string, sort?: string) {
  const { data, total } = await repo.listEmbarques(page, limit, notaVentaId, estado, sort)
  const conEstado = data.map((e) => ({ ...e, estadoListado: resolverEstadoListado(e) }))
  return { data: conEstado, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function obtenerEmbarque(id: number) {
  const embarque = await repo.getEmbarqueById(id)
  if (!embarque) throw new NotFoundError('Embarque', String(id))
  return embarque
}

// Arma el payload y llama al adapter — usado tanto al generar el Embarque
// como en el reintento manual. No toca la base de datos (eso lo hace la
// transacción del repositorio que invoca esto como `procesarReserva`).
//
// referenciaFas determinista, no un UUID aleatorio (IMP-QA-R1-012, QA ronda
// 2 + arbitraje): si una llamada anterior queda en estado incierto (timeout,
// o AGL360 acepta pero el guardado local falla justo después), un reintento
// para el MISMO Cierre debe mandar la MISMA referencia — el contrato exige
// que AGL360 deduplique por ella en vez de crear una segunda reserva (y de
// hecho eso es lo que documenta Docs/api-solicitudes.md: `referencia_externa`
// única por cuenta de servicio, reintento devuelve 200 con la existente).
//
// Payload real (2026-09-07, Docs/api-solicitudes.md) — reemplaza el payload
// de texto libre armado antes de tener la definición: los IDs de AGL360 se
// resuelven vía el mantenedor de Integraciones (Configuración →
// Integraciones, código 'AGL360'), nunca hardcodeados ni derivados de texto.
// referenciaFas por-embarque (2026-09-28): antes era `AGL-{empresa}-{nvId}`,
// pero al generar varios Embarques por Cierre eso colisionaba con el índice
// único de SolicitudReserva. Ahora deriva del numeroInstructivo (único por
// Embarque), sigue siendo determinista (IMP-QA-R1-012) y estable entre
// reintentos del mismo Embarque.
function referenciaFasDe(numeroInstructivo: string): string {
  return `AGL-${getEmpresaIdActual()!}-${numeroInstructivo}`
}

async function intentarReservaAgl(
  notaVentaId: number,
  referenciaFas: string,
  datosContenedor?: DatosContenedorInput,
): Promise<ResultadoIntentoReserva> {
  const nv = await repo.getNotaVentaParaReserva(notaVentaId)
  if (!nv) return { ok: false, error: 'El Cierre Comercial ya no existe' }

  const idCliente = await integracionesRepo.getValorParametro(CODIGO_INTEGRACION_AGL, 'IdCliente', {
    maestro: 'ENTIDAD',
    maestroId: nv.clienteId,
  })
  if (!idCliente) {
    return { ok: false, error: 'El Cliente de este Cierre Comercial no tiene un ID de AGL360 configurado (Configuración → Integraciones)' }
  }
  const idTipoEmbarque = await integracionesRepo.getValorParametro(CODIGO_INTEGRACION_AGL, 'IdTipoEmbarque', {
    maestro: 'TIPO_EMBARQUE',
    maestroId: nv.tipoEmbarqueId,
  })
  if (!idTipoEmbarque) {
    return { ok: false, error: 'El Tipo de Embarque de este Cierre Comercial no tiene un ID de AGL360 configurado (Configuración → Integraciones)' }
  }

  const idConsignee = nv.consignatarioId
    ? await integracionesRepo.getValorParametro(CODIGO_INTEGRACION_AGL, 'IdConsignee', { maestro: 'ENTIDAD', maestroId: nv.consignatarioId })
    : null
  const idPod = nv.puertoDestinoId
    ? await integracionesRepo.getValorParametro(CODIGO_INTEGRACION_AGL, 'IdPod', { maestro: 'PUERTO', maestroId: nv.puertoDestinoId })
    : null

  // idProducto: solo si todas las líneas del Cierre comparten la misma
  // especie — AGL360 acepta un único producto por solicitud y una NV puede
  // mezclar especies en su detalle (decisión de negocio, 2026-09-07).
  const especiesUnicas = [...new Set(nv.detalles.map((d) => d.especieId))]
  const idProducto = especiesUnicas.length === 1
    ? await integracionesRepo.getValorParametro(CODIGO_INTEGRACION_AGL, 'IdProducto', { maestro: 'ESPECIE', maestroId: especiesUnicas[0] })
    : null

  const payloadEnviado: SolicitudAglPayload = {
    referencia_externa: referenciaFas,
    idCliente: Number(idCliente),
    fechaSolicitud: new Date().toISOString().slice(0, 10),
    idTipoEmbarque: Number(idTipoEmbarque),
    // 1 contenedor = 1 Embarque = 1 solicitud (decisión de negocio, 2026-09-07).
    cantidadServicios: 1,
    ...(idConsignee ? { idConsignee: Number(idConsignee) } : {}),
    ...(idPod ? { idPod: Number(idPod) } : {}),
    ...(idProducto ? { idProducto: Number(idProducto) } : {}),
    ...(nv.direccionDetalle ? { direccionRetiro: nv.direccionDetalle } : {}),
    ...(datosContenedor?.temperatura != null ? { temperatura: datosContenedor.temperatura } : {}),
    ...(datosContenedor?.cbm != null ? { cbm: datosContenedor.cbm } : {}),
    observaciones: `Cierre Comercial folio ${nv.folio} — generado desde FAS`,
  }

  const resultado = await aglAdapter.crearSolicitud(payloadEnviado)
  if (!resultado.ok) return { ok: false, error: resultado.error }
  return { ok: true, referenciaFas, payloadEnviado, payloadRespuesta: resultado.payloadRespuesta ?? null }
}

// numeroInstructivo ya no se ingresa manualmente (2026-08-13, ventas.md R10
// — supersesión): se calcula como {prefijo del Tipo de Embarque}{folio de la
// NV, con el padding de dígitos configurado en Configuración → Prefijos}.
//
// Solicitud de Reserva (2026-09-05, ventas.md §4.3): generar el Embarque
// intenta primero reservar espacio con AGL360 — SIEMPRE se intenta
// (IMP-QA-R1-013, QA ronda 1: `forzarSinReserva` ya no salta el intento, un
// llamado directo a la API no puede evitarlo). Si falla, `forzarSinReserva`
// decide qué hacer: `false` aborta por completo (nada se crea, el frontend
// ofrece el diálogo "¿generar sin reserva?"); `true` crea el Embarque igual,
// en PENDIENTE. El lock + la transacción completa viven en
// repo.generarEmbarqueTransaccional (IMP-QA-R1-012).
// Estimación de contenedores (2026-09-28): total de pallets del Cierre = Σ
// techo(cajas / cajas por pallet) de sus líneas; contenedores sugeridos =
// techo(pallets / 20). Es solo una sugerencia editable en el diálogo — el
// usuario confirma cuántas reservas/embarques generar.
export const PALLETS_POR_CONTENEDOR = 20
export async function estimarContenedores(notaVentaId: number) {
  const notaVenta = await repo.getNotaVenta(notaVentaId)
  if (!notaVenta) throw new ValidationError('El Cierre Comercial seleccionado no existe')
  const detalles = await repo.getDetallesCajasCierre(notaVentaId)
  let totalPallets = 0
  for (const d of detalles) {
    if (d.cajasPorPallet > 0) totalPallets += Math.ceil(d.cajas / d.cajasPorPallet)
  }
  const contenedoresSugeridos = Math.max(1, Math.ceil(totalPallets / PALLETS_POR_CONTENEDOR))
  return { totalPallets, contenedoresSugeridos, palletsPorContenedor: PALLETS_POR_CONTENEDOR }
}

// Genera `cantidad` Embarques para un Cierre (uno por contenedor), cada uno con
// su propia Solicitud de Reserva. Los folios son correlativos secuenciales por
// prefijo (Tipo de Embarque): el Cierre 1 puede generar los embarques 1,2,3 y
// el Cierre 2 los 4,5 (2026-09-28, decisión de negocio Christian). Cada embarque
// se crea en su propia transacción; si uno falla, los anteriores quedan creados
// (se informa cuántos se generaron) — mismo criterio de "reintentar el resto".
export async function generarEmbarquesMultiples(
  body: EmbarqueCreateInput & { cantidad: number },
  creadoPor: string,
) {
  const notaVenta = await repo.getNotaVenta(body.notaVentaId)
  if (!notaVenta) throw new ValidationError('El Cierre Comercial seleccionado no existe')

  // La Solicitud de Reserva solo aplica a tipos de embarque que la requieren
  // (Aéreo/Marítimo). Para Terrestre (requiereReserva=false) el Embarque se crea
  // sin intentar el booking AGL360 ni registrar SolicitudReserva (2026-10-08).
  const requiereReserva = notaVenta.tipoEmbarque?.requiereReserva ?? false

  const gestor = await repo.getGestorLogistico(body.gestorLogisticoId)
  if (!gestor) throw new ValidationError('El Gestor Logístico seleccionado no existe o está inactivo')
  if (!gestor.tipos.includes('GESTOR_LOGISTICO')) {
    throw new ValidationError('La entidad seleccionada no tiene tipo Gestor Logístico')
  }

  const prefijoConfig = await prefijosService.obtenerPrefijoEmbarque(notaVenta.tipoEmbarqueId)
  if (!prefijoConfig) {
    throw new ValidationError(
      'No hay un prefijo configurado para el Tipo de Embarque de este Cierre Comercial. Configúralo en Configuración → Prefijos antes de generar el Embarque.',
    )
  }

  const cantidad = Math.floor(body.cantidad)
  if (!Number.isFinite(cantidad) || cantidad < 1) throw new ValidationError('La cantidad de contenedores debe ser al menos 1')
  if (cantidad > 100) throw new ValidationError('La cantidad de contenedores es demasiado alta (máximo 100)')

  // Información base por contenedor (2026-09-30): si viene, debe traer
  // exactamente un elemento por contenedor a crear — el frontend ya resolvió
  // la opción "mismo valor para todos" replicando el mismo objeto.
  if (body.contenedores && body.contenedores.length !== cantidad) {
    throw new ValidationError(`Los datos por contenedor (${body.contenedores.length}) no calzan con la cantidad de contenedores (${cantidad})`)
  }
  const tipoBlIds = [...new Set((body.contenedores ?? []).map((c) => c.tipoBlId).filter((v): v is number => v != null))]
  if (tipoBlIds.length > 0) {
    const validos = await Promise.all(tipoBlIds.map((id) => repo.getParametroTipoBl(id)))
    const invalido = tipoBlIds.find((_, i) => !validos[i])
    if (invalido != null) throw new ValidationError('El Tipo de BL seleccionado no existe o está bloqueado')
  }

  const modoAutomatico = await resolverModoAutomatico(body.gestorLogisticoId)

  // El correlativo se calcula y reserva DENTRO de cada transacción, bajo el
  // lock de prefijo (FAS-DEV-QA-R2-006) — no se precalcula acá para no arriesgar
  // números duplicados entre Cierres concurrentes del mismo prefijo. La
  // referenciaFas de la reserva se arma con el número ya asignado en la tx.
  //
  // Éxito parcial resumible (FAS-DEV-QA-R3-009): si la reserva automática de un
  // contenedor falla (y no es forzado), se CORTA el loop y se devuelven los ya
  // creados con `aglFallo: true`, en vez de abortar con 502 ocultando los
  // éxitos. El caller (frontend) reintenta SOLO los faltantes (N − creados) con
  // `forzarSinReserva`, así nunca se supera la cantidad pedida.
  const embarques = []
  let aglFallo = false
  for (let i = 1; i <= cantidad; i++) {
    const datosContenedor: DatosContenedorInput | undefined = body.contenedores?.[i - 1]
    try {
      const embarque = await repo.generarEmbarqueTransaccional(
        body.notaVentaId,
        prefijoConfig.prefijo,
        prefijoConfig.digitos,
        body.gestorLogisticoId,
        creadoPor,
        body.forzarSinReserva ?? false,
        modoAutomatico,
        requiereReserva,
        (numeroInstructivo) => intentarReservaAgl(body.notaVentaId, referenciaFasDe(numeroInstructivo), datosContenedor),
        datosContenedor,
      )
      embarques.push(embarque)
    } catch (e) {
      if (e instanceof repo.IntegracionAglFallidaError && !(body.forzarSinReserva ?? false)) {
        aglFallo = true
        break
      }
      throw e
    }
  }
  return { embarques, creados: embarques.length, aglFallo }
}

export async function generarEmbarque(body: EmbarqueCreateInput, creadoPor: string) {
  const { embarques, aglFallo } = await generarEmbarquesMultiples({ ...body, cantidad: 1 }, creadoPor)
  // La ruta singular conserva su contrato original (FAS-DEV-QA-R4-012): si la
  // reserva automática falló y no se creó el Embarque, relanza la falla de
  // integración (→ 502) en vez de devolver un recurso inexistente. El flujo
  // múltiple, en cambio, informa el éxito parcial con `aglFallo`.
  if (aglFallo || embarques.length === 0) {
    throw new repo.IntegracionAglFallidaError('No se pudo enviar la Solicitud de Reserva a AGL360')
  }
  return embarques[0]
}

// Reintento manual (pestaña "Solicitud de Reserva" de un Embarque ya
// PENDIENTE) — mismo intento de integración que generarEmbarque, pero sobre
// un Embarque que ya existe en vez de crear uno nuevo. Solo aplica a
// gestores con integración automática — un Embarque `reservaManual` no tiene
// nada que reintentar (repo.solicitarReservaTransaccional también lo valida
// bajo lock, esto es el pre-check amigable).
//
// IMP-QA-R1-016 (QA ronda 1): re-resuelve `modoAutomatico` en cada reintento
// en vez de asumirlo — la integración del gestor pudo desactivarse o
// desvincularse entre el fallo inicial y este reintento. `gestorLogisticoId`
// nulo (Embarque legacy, IMP-QA-R1-014) también cae a "no automático".
export async function solicitarReservaParaEmbarque(embarqueId: number, creadoPor: string) {
  const embarque = await obtenerEmbarque(embarqueId)
  if (embarque.estadoReserva !== 'PENDIENTE') {
    throw new ValidationError('Este Embarque ya tiene una Solicitud de Reserva enviada')
  }
  // El tipo de embarque debe requerir reserva (Aéreo/Marítimo). Terrestre no
  // reserva espacio logístico (2026-10-08).
  const nv = await repo.getNotaVenta(embarque.notaVentaId)
  if (!nv?.tipoEmbarque?.requiereReserva) {
    throw new ValidationError('El tipo de embarque de este Cierre no requiere Solicitud de Reserva')
  }
  if (embarque.reservaManual) {
    throw new ValidationError('Este Embarque está en modo de reserva manual — ingresa los datos de booking directamente')
  }

  const modoAutomatico = embarque.gestorLogisticoId ? await resolverModoAutomatico(embarque.gestorLogisticoId) : false
  if (!modoAutomatico) {
    throw new ValidationError(
      'Este Embarque ya no tiene un Gestor Logístico con integración automática activa — usa "Dejar Manual" para ingresar los datos a mano',
    )
  }

  return repo.solicitarReservaTransaccional(
    embarqueId,
    creadoPor,
    () => intentarReservaAgl(embarque.notaVentaId, referenciaFasDe(embarque.numeroInstructivo)),
  )
}

// "Dejar Manual" (2026-09-07, ventas.md §4.3) — desde un Embarque PENDIENTE,
// abandona el camino automático (si lo había) y habilita el tipeo directo
// de los datos de booking. `actualizadoPor` (IMP-QA-R1-017, QA ronda 1):
// auditoría estándar de la convención global (CLAUDE.md §5).
export async function dejarReservaManual(embarqueId: number, actualizadoPor: string) {
  return repo.marcarReservaManualTransaccional(embarqueId, actualizadoPor)
}

// Guarda los datos de booking manual — exige reservaManual=true (ver
// repo.guardarDatosReservaManual). CONFIRMADA en cuanto se guarda.
export async function guardarDatosReservaManual(embarqueId: number, datos: DatosReservaManualInput, actualizadoPor: string) {
  return repo.guardarDatosReservaManual(embarqueId, datos, actualizadoPor)
}

// Información base de la reserva (2026-09-28) — datos propios del Embarque.
export async function guardarDatosReservaBase(embarqueId: number, datos: DatosReservaBaseInput, actualizadoPor: string) {
  await obtenerEmbarque(embarqueId)
  if (datos.tipoBlId != null) {
    const tipoBl = await repo.getParametroTipoBl(datos.tipoBlId)
    if (!tipoBl) throw new ValidationError('El Tipo de BL seleccionado no existe o está bloqueado')
  }
  return repo.guardarDatosReservaBase(embarqueId, datos, actualizadoPor)
}

// ─── Instructivo de Embarque (2026-09-21, ventas.md R11) ───────────────────

async function validarEntidadDeTipo(id: number, tipo: TipoEntidad, etiqueta: string) {
  const entidad = await repo.getEntidadConTipos(id)
  if (!entidad) throw new ValidationError(`${etiqueta} seleccionado no existe o está inactivo`)
  if (!entidad.tipos.includes(tipo)) {
    throw new ValidationError(`La entidad seleccionada no tiene tipo ${etiqueta}`)
  }
}

// Datos compartidos del Instructivo (puerto de zarpe, voyage, depósito,
// AWB/BL, cutoff, tipo de bultos, agente de aduana, embarcador, naviera) —
// independiente de reservaManual, editable siempre desde la pestaña "Generar
// Instructivos".
export async function guardarDatosInstructivo(embarqueId: number, datos: DatosInstructivoInput, actualizadoPor: string) {
  await obtenerEmbarque(embarqueId)
  if (datos.puertoZarpeId != null) {
    const puerto = await repo.getPuertoPorId(datos.puertoZarpeId)
    if (!puerto) throw new ValidationError('El Puerto de Zarpe seleccionado no existe')
  }
  if (datos.agenteAduanaId != null) await validarEntidadDeTipo(datos.agenteAduanaId, 'AGENTE_ADUANA', 'Agente de Aduana')
  if (datos.embarcadorId != null) await validarEntidadDeTipo(datos.embarcadorId, 'COMPANIA_EMBARQUE', 'Embarcador')
  if (datos.navieraId != null) await validarEntidadDeTipo(datos.navieraId, 'NAVIERA', 'Naviera')

  return repo.guardarDatosInstructivo(embarqueId, datos, actualizadoPor)
}

export async function listarInstructivosHijos(embarqueId: number) {
  await obtenerEmbarque(embarqueId)
  return repo.listInstructivosHijos(embarqueId)
}

// Botón explícito "Generar Instructivos" (decisión de negocio, Christian,
// 2026-09-21) — deriva/sincroniza los InstructivoHijo desde los pallets ya
// reservados al Embarque, agrupando por Planta. No se recalcula
// automáticamente al reservar/desvincular pallets.
export async function generarInstructivosHijos(embarqueId: number, actualizadoPor: string) {
  await obtenerEmbarque(embarqueId)
  return repo.generarInstructivosHijos(embarqueId, actualizadoPor)
}

export async function actualizarInstructivoHijo(
  embarqueId: number,
  instructivoId: number,
  datos: InstructivoHijoUpdateInput,
  actualizadoPor: string,
) {
  await obtenerEmbarque(embarqueId)
  return repo.updateInstructivoHijo(embarqueId, instructivoId, datos, actualizadoPor)
}

// ─── Webhook AGL360 (confirmación) ──────────────────────────────────────────

// Contrato real (Docs/webhook-fas.md): AGL360 reintenta hasta 5 veces con
// esperas crecientes si no recibe un 2xx — el endpoint debe ser idempotente
// ante la MISMA notificación repetida (mismo idOrdenServicio). Se distingue
// de una notificación genuinamente distinta para la misma Solicitud de
// Reserva (no debería pasar por el flujo de negocio actual — 1 Cierre = a lo
// más 1 Orden — pero si pasara, es una anomalía real, no un reintento).
export async function confirmarSolicitudDesdeWebhook(body: AglWebhookConfirmarBody) {
  const solicitud = await repo.getSolicitudPorReferencia(body.referencia_externa)
  if (!solicitud) {
    // 409, no 404 (IMP-QA-R1-012, QA ronda 1): si AGL360 confirmara en el
    // mismo instante en que acepta la solicitud, el webhook podría llegar
    // antes de que termine nuestra transacción local de creación — un 409
    // (reintentable) le indica a AGL360 que reintente en vez de descartar la
    // confirmación como si la referencia nunca fuera a existir.
    throw new ConflictError(`No se encontró la Solicitud de Reserva "${body.referencia_externa}" — si se acaba de enviar, reintenta en unos segundos`)
  }

  if (solicitud.confirmadoEn) {
    // Reintento de la MISMA notificación (mismo idOrdenServicio): no-op,
    // 2xx sin volver a escribir nada — exactamente lo que pide
    // Docs/webhook-fas.md ("no debe duplicar efectos").
    if (solicitud.idOrdenServicioAgl === body.idOrdenServicio) return
    // idOrdenServicio DISTINTO para una Solicitud ya confirmada: el flujo de
    // negocio actual asume 1 Solicitud -> 1 Orden, así que esto es una
    // anomalía (¿AGL360 recreó la orden?) y no un reintento — se rechaza en
    // vez de pisar silenciosamente el registro anterior.
    throw new ConflictError(
      `Esta Solicitud de Reserva ya fue confirmada con otra Orden de Servicio (#${solicitud.idOrdenServicioAgl}) — no se puede confirmar de nuevo con #${body.idOrdenServicio}`,
    )
  }

  await repo.confirmarSolicitud(solicitud.id, solicitud.embarqueId, {
    idOrdenServicioAgl: body.idOrdenServicio,
    idSolicitudServicioAgl: body.idSolicitudServicio,
    estadoOrdenAgl: body.estadoOrden,
    payloadRespuesta: body,
  })
}

// ─── Seleccionar Pallets (ventas.md R8/R9) ──────────────────────────────────
//
// EP-QA-003 (confirmarDespacho() no exigía reconciliación contra Packing
// List, compras.md §9.3) CERRADA 2026-09-22 — ver subirPackingList() más
// abajo y el gate en repo.confirmarDespacho.
//
// EP-QA-004 (reservar pallets no generaba InstructivoHijo) CERRADA
// 2026-09-21: la generación es un botón explícito ("Generar Instructivos" en
// el detalle del Embarque, decisión de negocio Christian) en vez de un
// recompute automático al reservar/desvincular — ver
// generarInstructivosHijos más abajo.

// Pallets sin reservar que calzan con el detalle de la NV de este Embarque —
// candidatos para el paso "Seleccionar Pallets" (solo catálogo, sin tope de
// cantidad — decisión de negocio, Christian, 2026-09-02).
export async function listarPalletsDisponibles(embarqueId: number) {
  const embarque = await obtenerEmbarque(embarqueId)
  const notaVenta = await repo.getNotaVentaConDetalle(embarque.notaVentaId)
  if (!notaVenta) throw new ValidationError('El Cierre Comercial de este Embarque ya no existe')
  return repo.getPalletsDisponibles(notaVenta.detalles)
}

// Reclamo atómico en el repositorio (reservarPalletsEnEmbarque) es la
// defensa real contra dos Embarques reservando el mismo pallet a la vez; acá
// solo se valida existencia del Embarque y que las líneas calcen con el
// detalle de la NV (pre-check, mismo criterio que el motor de Recepción).
// Agregar pallets se permite incluso con el Embarque ya despachado
// (decisión de negocio, Christian) — solo desvincular queda bloqueado.
export async function agregarPallets(embarqueId: number, palletIds: number[]) {
  const embarque = await obtenerEmbarque(embarqueId)
  const unicos = Array.from(new Set(palletIds))
  const notaVenta = await repo.getNotaVentaConDetalle(embarque.notaVentaId)
  if (!notaVenta) throw new ValidationError('El Cierre Comercial de este Embarque ya no existe')

  const disponibles = await repo.getPalletsDisponibles(notaVenta.detalles)
  const disponiblesIds = new Set(disponibles.map((p) => p.id))
  const fueraDeAlcance = unicos.filter((id) => !disponiblesIds.has(id))
  if (fueraDeAlcance.length > 0) {
    throw new ValidationError(
      `Uno o más pallets no están disponibles o no calzan con el detalle de este Cierre Comercial: ${fueraDeAlcance.join(', ')}`,
    )
  }

  await repo.reservarPalletsEnEmbarque(unicos, embarqueId)
  return repo.getEmbarqueById(embarqueId)
}

export async function quitarPallet(embarqueId: number, palletId: number) {
  const resultado = await repo.desvincularPallet(embarqueId, palletId)
  if (resultado === 'NO_ENCONTRADO') {
    await obtenerEmbarque(embarqueId) // 404 si el Embarque ya no existe
    throw new NotFoundError('Pallet reservado a este Embarque', String(palletId))
  }
  if (resultado === 'DESPACHADO') {
    throw new ConflictError('No se puede desvincular un pallet de un Embarque ya despachado')
  }
  return repo.getEmbarqueById(embarqueId)
}

// ─── Despachar ───────────────────────────────────────────────────────────────

export async function confirmarDespacho(embarqueId: number, userId: string) {
  const resultado = await repo.confirmarDespacho(embarqueId, userId)
  if (resultado === 'NO_ENCONTRADO') throw new NotFoundError('Embarque', String(embarqueId))
  if (resultado === 'YA_DESPACHADO') throw new ConflictError('Este Embarque ya fue despachado')
  if (resultado === 'SIN_PALLETS') throw new ValidationError('No se puede despachar un Embarque sin pallets reservados')
  if (resultado === 'SIN_PACKING_LIST') {
    throw new ValidationError('Debes subir y reconciliar el Packing List de este Embarque antes de despachar (compras.md §9.3)')
  }
  if (resultado === 'PACKING_LIST_CON_DISCREPANCIAS') {
    throw new ValidationError('El Packing List cargado tiene discrepancias contra los pallets reservados — corrígelas y vuelve a subirlo antes de despachar')
  }
  if (resultado === 'PACKING_LIST_INCOMPLETO') {
    throw new ValidationError('El Packing List no cubre todos los pallets reservados — falta cargar el/los archivo(s) de los pallets restantes antes de despachar')
  }
  return resultado
}

// "Anular Despacho" (2026-09-22, decisión de negocio Christian) — soft
// delete de la confirmación (repo.anularDespacho): los pallets NO se
// desvinculan, quedan reservados/seleccionados; se borran los
// InstructivoHijo y la reconciliación de Packing List vigente, ambos
// derivados de un despacho que ya no es válido.
export async function anularDespacho(embarqueId: number, userId: string) {
  const resultado = await repo.anularDespacho(embarqueId, userId)
  if (resultado === 'NO_ENCONTRADO') throw new NotFoundError('Embarque', String(embarqueId))
  if (resultado === 'NO_DESPACHADO') throw new ValidationError('Este Embarque no está despachado')
  if (resultado === 'TIENE_RECLAMOS') {
    throw new ValidationError('Este Embarque tiene Reclamos registrados — no se puede anular el despacho')
  }
  return repo.getEmbarqueById(embarqueId)
}

// ─── Packing List (compras.md §9.3, cierra EP-QA-003) ──────────────────────
//
// Reconciliación a nivel de pallet (compras.md §9.3): los N° de Pallet del PL
// deben ser exactamente los reservados al Embarque, y el detalle de cada
// pallet coincidente debe cuadrar contra Stock. No inserta nada — a
// diferencia del motor de Recepción, los pallets ya existen; esto solo
// compara y persiste el resultado (embarques.packing-list.motor.ts). Todo o
// nada a nivel de ARCHIVO (formato/mapeo/maestros abortan sin guardar,
// mismos criterios que Recepción) pero las discrepancias de negocio (Paso
// 1/2) SÍ se guardan como estado DISCREPANCIA — el usuario necesita ver qué
// no cuadró para poder corregirlo y reintentar.
const MIMES_EXCEL_PERMITIDOS = new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
export const MAX_PACKING_LIST_BYTES = 10 * 1024 * 1024 // 10 MB, mismo tope que Recepción

async function validarTemplateCargaPackingList(templateCargaId: number) {
  const template = await templatesCargaRepo.getTemplateCargaById(templateCargaId)
  if (!template) throw new ValidationError('El Template de Carga seleccionado no existe')
  if (template.bloqueado) throw new ValidationError('El Template de Carga seleccionado está bloqueado')
  if (template.tipo !== 'PACKING_LIST') throw new ValidationError('El Template de Carga seleccionado no es de tipo Packing List')
  return template
}

export async function subirPackingList(
  embarqueId: number,
  templateCargaId: number,
  archivo: { nombre: string; mime: string; datos: Buffer },
  userId: string,
) {
  const embarque = await obtenerEmbarque(embarqueId)
  if (embarque.despachadoEn && !embarque.despachoAnuladoEn) {
    throw new ValidationError('Este Embarque ya fue despachado — no admite reconciliar un nuevo Packing List')
  }
  // 2026-09-28 (decisión de negocio Christian): el Packing List de despacho
  // solo se puede cargar una vez emitido(s) el/los Instructivo(s) de Embarque
  // (InstructivoHijo generados por planta).
  const instructivos = await repo.contarInstructivosHijos(embarqueId)
  if (instructivos === 0) {
    throw new ValidationError('Debes generar el/los Instructivo(s) de Embarque antes de cargar el Packing List de despacho')
  }
  if (!MIMES_EXCEL_PERMITIDOS.has(archivo.mime)) {
    throw new ValidationError('Tipo de archivo no permitido. Se acepta solo Excel (.xlsx)')
  }
  if (archivo.datos.length > MAX_PACKING_LIST_BYTES) {
    throw new ValidationError('El archivo supera el tamaño máximo de 10 MB')
  }

  const template = await validarTemplateCargaPackingList(templateCargaId)

  const palletsStock = await repo.getPalletsReservadosParaReconciliar(embarqueId)
  if (palletsStock.length === 0) {
    throw new ValidationError('Este Embarque no tiene pallets reservados — no hay nada que reconciliar contra el Packing List')
  }

  const resultado = await reconciliarPackingList(template, archivo.datos, palletsStock)

  return repo.guardarPackingList(embarqueId, {
    templateCargaId,
    nombreArchivo: archivo.nombre,
    mime: archivo.mime,
    tamano: archivo.datos.length,
    contenido: archivo.datos,
    estado: resultado.estado,
    discrepancias: resultado.discrepancias,
    numerosPallet: resultado.numerosPallet,
    cargadoPor: userId,
  })
}

export async function descargarPackingList(embarqueId: number, packingListId?: number) {
  await obtenerEmbarque(embarqueId)
  const resultado = await repo.getPackingListParaDescarga(embarqueId, packingListId)
  if (!resultado) throw new NotFoundError('Packing List', String(embarqueId))
  return resultado
}

export async function eliminarPackingList(embarqueId: number, packingListId: number, userId: string) {
  const resultado = await repo.eliminarPackingList(embarqueId, packingListId, userId)
  if (resultado === 'NO_ENCONTRADO') throw new NotFoundError('Packing List', String(packingListId))
  if (resultado === 'DESPACHADO') {
    throw new ValidationError('No se puede eliminar un Packing List de un Embarque ya despachado')
  }
  return repo.getEmbarqueById(embarqueId)
}
