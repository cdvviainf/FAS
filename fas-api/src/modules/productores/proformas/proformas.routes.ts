import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './proformas.controller.js'

const ITEM = 'PRODUCTORES_PROFORMA'

export async function proformasProductorRoutes(app: FastifyInstance) {
  app.get('/proformas', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/proformas/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/proformas', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/proformas/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
  app.post('/proformas/:id/enviar-validacion', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.enviarValidacion)
  app.post('/proformas/:id/rechazar', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.rechazar)
  app.post('/proformas/:id/anular', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.anular)
}
