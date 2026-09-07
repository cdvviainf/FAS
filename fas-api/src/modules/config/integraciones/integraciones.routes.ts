import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './integraciones.controller.js'

const ITEM = 'CONFIG_INTEGRACIONES'

export async function integracionesRoutes(app: FastifyInstance) {
  app.get('/integraciones', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/integraciones/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/integraciones', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/integraciones/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
  app.delete('/integraciones/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.remove)
  app.post('/integraciones/:id/parametros', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.addParametro)
  app.patch('/integraciones/:id/parametros/:parametroId', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.updateParametro)
  app.delete('/integraciones/:id/parametros/:parametroId', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.removeParametro)
  app.get('/integraciones/maestros/:maestro', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.listOpcionesMaestro)
}
