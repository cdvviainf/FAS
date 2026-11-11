import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './solicitudes-pago.controller.js'
import { ITEM_SOLICITUD_PAGO as ITEM, ITEM_SOLICITUD_PAGO_CONFIRMAR as ITEM_CONFIRMAR } from './solicitudes-pago.types.js'

// Solicitud de Pago a Productores (2026-11-10). Crear/editar/anular (Solicitada)
// = TOTAL en la pantalla; confirmar pago = permiso aparte (ACCION).
export async function solicitudesPagoRoutes(app: FastifyInstance) {
  app.get('/solicitudes-pago/despachado', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.despachado)
  app.get('/solicitudes-pago/pendientes', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.pendientes)
  app.get('/solicitudes-pago', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/solicitudes-pago/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/solicitudes-pago', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.put('/solicitudes-pago/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
  app.post('/solicitudes-pago/:id/confirmar-pago', { preHandler: [requireAuth, requireLevel(ITEM_CONFIRMAR, 'TOTAL')] }, ctrl.confirmarPago)
  app.post('/solicitudes-pago/:id/anular', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.anular)
}
