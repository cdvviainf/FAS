import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './movimientos.controller.js'

const ITEM = 'OPER_MATERIALES'

export async function movimientosRoutes(app: FastifyInstance) {
  app.get('/movimientos', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/movimientos/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/movimientos', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/movimientos/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
  app.delete('/movimientos/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.remove)
  app.post('/movimientos/:id/detalle', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.addLinea)
  app.patch('/movimientos/:id/detalle/:detalleId', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.updateLinea)
  app.delete('/movimientos/:id/detalle/:detalleId', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.removeLinea)
  app.post('/movimientos/:id/confirmar', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.confirmar)

  app.get('/saldos', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.listSaldos)
  app.post('/consulta-stock-receta', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.consultaStockReceta)
}
