import type { FastifyInstance } from 'fastify'
import { requireAuth, requireAnyLevel, requireLevel, requireAglWebhookSignature } from '../../../plugins/auth-guard.js'
import * as ctrl from './embarques.controller.js'

const ITEM = 'VENTAS_EMBARQUES'
// El selector "Nueva Proforma" (Facturación Exportación) lee este mismo
// listado para elegir el Embarque despachado a facturar (FAS-PROF-EXP-009,
// QA ronda 4) — mismo criterio que reclamos.routes.ts (CAL_RECLAMOS |
// VENTAS_RECLAMOS): la lectura acepta cualquiera de los dos ítems, sin
// exigir acceso a Embarques solo para poder emitir una Proforma.
const ITEM_FACTURACION_EXPORTACION = 'FACT_EXPORTACION'

export async function embarquesRoutes(app: FastifyInstance) {
  app.get(
    '/embarques',
    { preHandler: [requireAuth, requireAnyLevel([ITEM, ITEM_FACTURACION_EXPORTACION], 'LECTURA')] },
    ctrl.list,
  )
  app.get('/embarques/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/embarques', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  // Generación múltiple: una reserva/Embarque por contenedor (2026-09-28).
  app.get('/embarques/estimacion-contenedores', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.estimacionContenedores)
  app.post('/embarques/multiples', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.createMultiples)

  // ─── Solicitud de Reserva (ventas.md §4.3) ─────────────────────────────────
  app.post(
    '/embarques/:id/solicitud-reserva',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    ctrl.solicitarReserva,
  )
  app.post(
    '/embarques/:id/reserva-manual',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    ctrl.dejarReservaManual,
  )
  app.patch(
    '/embarques/:id/datos-reserva',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    ctrl.guardarDatosReservaManual,
  )
  // Sello/precinto del contenedor — editable en ambos modos de reserva.
  app.patch(
    '/embarques/:id/sello',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    ctrl.actualizarSello,
  )
  app.patch(
    '/embarques/:id/datos-reserva-base',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    ctrl.guardarDatosReservaBase,
  )

  // ─── Instructivo de Embarque (2026-09-21, ventas.md R11) ─────────────────
  app.patch(
    '/embarques/:id/datos-instructivo',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    ctrl.guardarDatosInstructivo,
  )
  app.get(
    '/embarques/:id/instructivos',
    { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] },
    ctrl.listarInstructivosHijos,
  )
  app.post(
    '/embarques/:id/instructivos/generar',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    ctrl.generarInstructivosHijos,
  )
  app.patch(
    '/embarques/:id/instructivos/:instructivoId',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    ctrl.actualizarInstructivoHijo,
  )
  // Webhook AGL360 -> FAS: sin requireAuth/requireLevel a propósito (no hay
  // sesión de usuario) — se autentica por firma HMAC compartida
  // (Docs/webhook-fas.md).
  app.post(
    '/embarques/webhooks/agl360-confirmacion',
    { preHandler: [requireAglWebhookSignature] },
    ctrl.confirmarWebhookAgl,
  )

  // ─── Seleccionar Pallets ──────────────────────────────────────────────────
  app.get(
    '/embarques/:id/pallets-disponibles',
    { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] },
    ctrl.listarPalletsDisponibles,
  )
  app.post('/embarques/:id/pallets', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.agregarPallets)
  app.delete(
    '/embarques/:id/pallets/:palletId',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    ctrl.quitarPallet,
  )

  // ─── Despachar ────────────────────────────────────────────────────────────
  app.patch('/embarques/:id/despachar', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.despachar)
  app.patch(
    '/embarques/:id/anular-despacho',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    ctrl.anularDespacho,
  )

  // ─── Guía de Despacho (DTE 52, 2026-10-09) — opcional tras el despacho ────
  app.get(
    '/embarques/:id/guia-despacho',
    { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] },
    ctrl.obtenerGuiaDespacho,
  )
  app.post(
    '/embarques/:id/guia-despacho/emitir',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    ctrl.emitirGuiaDespacho,
  )
  app.post(
    '/embarques/:id/guia-despacho/firmar',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    ctrl.firmarGuiaDespacho,
  )
  app.get(
    '/embarques/:id/guia-despacho/pdf',
    { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] },
    ctrl.descargarGuiaDespachoPdf,
  )
  // Guía emitida por un tercero (2026-10-12): registrar número + emisor, o quitarla.
  app.post(
    '/embarques/:id/guia-despacho/externa',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    ctrl.registrarGuiaExterna,
  )
  app.delete(
    '/embarques/:id/guia-despacho/externa',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    ctrl.quitarGuiaExterna,
  )

  // ─── Packing List (compras.md §9.3, cierra EP-QA-003) ────────────────────
  app.post(
    '/embarques/:id/packing-list',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    ctrl.subirPackingList,
  )
  app.get(
    '/embarques/:id/packing-list/descarga',
    { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] },
    ctrl.descargarPackingList,
  )
  app.delete(
    '/embarques/:id/packing-list/:packingListId',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    ctrl.eliminarPackingList,
  )

  // ─── Reclamos (2026-09-08, reclamos.md) — se crean desde acá ───────────────
  app.get(
    '/embarques/:id/lineas-reclamables',
    { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] },
    ctrl.listarLineasReclamables,
  )
  app.post('/embarques/:id/reclamos', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.crearReclamo)
  app.get(
    '/embarques/:id/reclamos',
    { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] },
    ctrl.listarReclamosDelEmbarque,
  )
  app.patch(
    '/embarques/:id/reclamos/:reclamoId',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    ctrl.actualizarReclamo,
  )
}
