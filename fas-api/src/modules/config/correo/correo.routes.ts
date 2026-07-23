import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './correo.controller.js'

const ITEM = 'CONFIG_GENERAL'

export async function correoRoutes(app: FastifyInstance) {
  app.get('/correo', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getConfiguracion)
  app.put('/correo', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.putConfiguracion)
  app.post('/correo/probar', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.postProbar)
}
