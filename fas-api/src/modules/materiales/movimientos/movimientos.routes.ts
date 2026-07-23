import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './movimientos.controller.js'

const ITEM = 'OPER_MATERIALES'

export async function movimientosRoutes(app: FastifyInstance) {
  app.get('/movimientos', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/movimientos/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/movimientos', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)

  app.get('/saldos', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.listSaldos)
  app.post('/consulta-stock-receta', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.consultaStockReceta)
}
