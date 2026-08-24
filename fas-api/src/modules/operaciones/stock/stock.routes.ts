import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './stock.controller.js'

// ItemMenu ya sembrado (prisma/seed.ts) como placeholder de esta pantalla —
// "Stock Fruta", sección Operaciones.
const ITEM = 'OPER_STOCK'

export async function stockRoutes(app: FastifyInstance) {
  app.get('/stock', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.resumen)
  app.get('/stock/detalle', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.detalle)
}
