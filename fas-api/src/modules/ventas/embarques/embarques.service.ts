import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './embarques.repository.js'
import * as prefijosService from '../../config/prefijos-codigo/prefijos-codigo.service.js'
import * as aglAdapter from './agl360.adapter.js'
import * as integracionesRepo from '../../config/integraciones/integraciones.repository.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import type { ResultadoIntentoReserva } from './embarques.repository.js'
import type { EmbarqueCreateInput } from './embarques.types.js'
import type { AglWebhookConfirmarBody } from './embarques.schema.js'
import type { SolicitudAglPayload } from './agl360.adapter.js'

const CODIGO_INTEGRACION_AGL = 'AGL360'

export async function listarEmbarques(page: number, limit: number, notaVentaId?: number) {
  const { data, total } = await repo.listEmbarques(page, limit, notaVentaId)
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
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
async function intentarReservaAgl(notaVentaId: number): Promise<ResultadoIntentoReserva> {
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

  const referenciaFas = `AGL-${getEmpresaIdActual()!}-${notaVentaId}`
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
export async function generarEmbarque(body: EmbarqueCreateInput, creadoPor: string) {
  const notaVenta = await repo.getNotaVenta(body.notaVentaId)
  if (!notaVenta) throw new ValidationError('El Cierre Comercial seleccionado no existe')

  const prefijoConfig = await prefijosService.obtenerPrefijoEmbarque(notaVenta.tipoEmbarqueId)
  if (!prefijoConfig) {
    throw new ValidationError(
      'No hay un prefijo configurado para el Tipo de Embarque de este Cierre Comercial. Configúralo en Configuración → Prefijos antes de generar el Embarque.',
    )
  }
  const numeroInstructivo = prefijosService.formatearConPrefijo(prefijoConfig.prefijo, prefijoConfig.digitos, notaVenta.folio)

  // Pre-check amigable, no autoritativo (mismo patrón que confirmarMovimiento
  // en materiales/movimientos.service.ts) — la autoridad real vuelve a
  // revisar esto bajo lock dentro de generarEmbarqueTransaccional; esto solo
  // evita llamar a AGL360 para un error obvio.
  const existente = await repo.findByNumeroInstructivo(numeroInstructivo)
  if (existente) {
    throw new ValidationError(
      `Ya existe un Embarque con el número "${numeroInstructivo}" — probablemente ya se generó un Embarque para este Cierre Comercial.`,
    )
  }

  return repo.generarEmbarqueTransaccional(
    body.notaVentaId,
    numeroInstructivo,
    creadoPor,
    body.forzarSinReserva ?? false,
    () => intentarReservaAgl(body.notaVentaId),
  )
}

// Reintento manual (pestaña "Solicitud de Reserva" de un Embarque ya
// PENDIENTE) — mismo intento de integración que generarEmbarque, pero sobre
// un Embarque que ya existe en vez de crear uno nuevo.
export async function solicitarReservaParaEmbarque(embarqueId: number, creadoPor: string) {
  const embarque = await obtenerEmbarque(embarqueId)
  if (embarque.estadoReserva !== 'PENDIENTE') {
    throw new ValidationError('Este Embarque ya tiene una Solicitud de Reserva enviada')
  }

  return repo.solicitarReservaTransaccional(
    embarqueId,
    creadoPor,
    () => intentarReservaAgl(embarque.notaVentaId),
  )
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
// Deuda aceptada explícitamente (decisión de negocio, Christian, 2026-09-02
// — QA ronda 3, EP-QA-003/EP-QA-004, ambos persisten a propósito, no son
// bugs de esta entrega):
//   - EP-QA-003: confirmarDespacho() no exige reconciliación contra Packing
//     List (compras.md §9.3) — ese módulo no existe todavía en el sistema.
//   - EP-QA-004: reservar pallets no genera InstructivoHijo por punto de
//     retiro (ventas.md R11) — ese modelo tampoco existe; la pestaña
//     "Generar Instructivos" sigue como placeholder a propósito.
// Ninguno de los dos bloquea lo construido en esta entrega (Seleccionar
// Pallets + Despachar mínimo); quedan para cuando se aborden esos módulos.

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
  return resultado
}
