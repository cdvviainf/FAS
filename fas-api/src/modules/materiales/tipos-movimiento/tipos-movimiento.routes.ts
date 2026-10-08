import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './tipos-movimiento.controller.js'

const ITEM = 'CONFIG_TIPOS_MOVIMIENTO'

export async function tiposMovimientoRoutes(app: FastifyInstance) {
  app.get('/tipos-movimiento', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/tipos-movimiento/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/tipos-movimiento', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/tipos-movimiento/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
}
