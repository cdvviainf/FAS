import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './stock.controller.js'

// ItemMenu: "Stock de Fruta", sección Reportes (prisma/seed.ts) — reemplaza a
// OPER_STOCK (2026-08-24).
const ITEM = 'REPORTES_STOCK_FRUTA'

export async function stockRoutes(app: FastifyInstance) {
  app.get('/stock', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.listar)
}
