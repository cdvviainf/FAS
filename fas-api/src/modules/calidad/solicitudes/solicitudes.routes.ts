import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './solicitudes.controller.js'

const ITEM = 'CAL_SOLICITUDES'

export async function solicitudesRoutes(app: FastifyInstance) {
  // Lectura
  app.get('/solicitudes', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/solicitudes/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.get('/solicitudes/:id/adjuntos/:adjuntoId/descarga', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.descargarAdjunto)

  // Escritura
  app.post('/solicitudes', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/solicitudes/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
  app.delete('/solicitudes/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.remove)
  app.post('/solicitudes/:id/notificar', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.notificar)
  app.post('/solicitudes/:id/reabrir', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.reabrir)

  // Cerrar y adjuntar: basta LECTURA en el ítem — el service exige además ser
  // asignado ACUDIR (o tener nivel TOTAL) para cerrar. Un inspector puede tener
  // solo lectura del módulo y aun así completar su inspección.
  app.post('/solicitudes/:id/cerrar', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.cerrar)
  app.post('/solicitudes/:id/adjuntos', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.subirAdjunto)
  app.delete('/solicitudes/:id/adjuntos/:adjuntoId', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.eliminarAdjunto)
}
