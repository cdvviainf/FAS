import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './notas-venta.controller.js'

const ITEM = 'VENTAS_NV' // "Cierre Comercial"

export async function notasVentaRoutes(app: FastifyInstance) {
  app.get('/notas-venta', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/notas-venta/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/notas-venta', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/notas-venta/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
  app.delete('/notas-venta/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.remove)
  app.post('/notas-venta/:id/detalles', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.addDetalle)
  app.patch('/notas-venta/:id/detalles/:detalleId', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.updateDetalle)
  app.delete('/notas-venta/:id/detalles/:detalleId', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.removeDetalle)
}
