import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './embarques.controller.js'

const ITEM = 'VENTAS_EMBARQUES'

export async function embarquesRoutes(app: FastifyInstance) {
  app.get('/embarques', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/embarques/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/embarques', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)

  // ─── Seleccionar Pallets ──────────────────────────────────────────────────
  app.get(
    '/embarques/:id/pallets-disponibles',
    { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] },
    ctrl.listarPalletsDisponibles,
  )
  app.post('/embarques/:id/pallets', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.agregarPallets)
  app.delete(
    '/embarques/:id/pallets/:palletId',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    ctrl.quitarPallet,
  )

  // ─── Despachar ────────────────────────────────────────────────────────────
  app.patch('/embarques/:id/despachar', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.despachar)
}
