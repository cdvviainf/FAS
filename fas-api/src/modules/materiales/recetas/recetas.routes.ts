import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './recetas.controller.js'

const ITEM = 'OPER_MATERIALES'

export async function recetasRoutes(app: FastifyInstance) {
  app.get('/articulos/:id/recetas', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.listPorEmbalaje)
  app.get('/recetas/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/recetas', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/recetas/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
}
