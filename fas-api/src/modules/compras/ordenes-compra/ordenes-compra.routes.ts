import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './ordenes-compra.controller.js'

const ITEM = 'COMPRAS_OC'

export async function ordenesCompraRoutes(app: FastifyInstance) {
  app.get('/ordenes-compra', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/ordenes-compra/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/ordenes-compra', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/ordenes-compra/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
  app.delete('/ordenes-compra/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.remove)
  app.post('/ordenes-compra/:id/lineas', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.addLinea)
  app.patch('/ordenes-compra/:id/lineas/:lineaId', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.updateLinea)
  app.delete('/ordenes-compra/:id/lineas/:lineaId', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.removeLinea)
  // Grilla del formulario de OC al elegir Cierre Comercial (2026-08-23) —
  // mismo ítem/nivel que leer una OC, no requiere permiso de Ventas.
  app.get(
    '/ordenes-compra/notas-venta/:notaVentaId/disponibilidad',
    { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] },
    ctrl.disponibilidadCierre,
  )
}
