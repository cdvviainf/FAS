import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './proformas-venta.controller.js'

const ITEM = 'MATERIALES_PROFORMA'

export async function proformasVentaMaterialRoutes(app: FastifyInstance) {
  app.get('/proformas', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/proformas/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/proformas', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/proformas/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
  app.patch('/proformas/:id/lineas/:lineaId', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.updateLinea)
  app.post('/proformas/:id/enviar-validacion', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.enviarValidacion)
  app.post('/proformas/:id/anular', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.anular)
}
