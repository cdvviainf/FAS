import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './recepciones.controller.js'

const ITEM = 'COMPRAS_RECEPCION'

export async function recepcionesRoutes(app: FastifyInstance) {
  app.get('/recepciones', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/recepciones/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/recepciones', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/recepciones/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
  app.delete('/recepciones/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.remove)

  app.get(
    '/recepciones/:id/adjuntos/:adjuntoId/descarga',
    { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] },
    ctrl.descargarAdjunto,
  )
  app.post('/recepciones/:id/adjuntos', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.subirAdjunto)
  app.delete(
    '/recepciones/:id/adjuntos/:adjuntoId',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    ctrl.eliminarAdjunto,
  )
}
