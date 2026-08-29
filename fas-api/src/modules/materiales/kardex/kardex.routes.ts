import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './kardex.controller.js'

// ItemMenu: "Kardex de Materiales", sección Reportes (prisma/seed.ts) —
// permiso independiente de OPER_MATERIALES, igual que REPORTES_STOCK_FRUTA.
const ITEM = 'REPORTES_KARDEX_MATERIALES'

export async function kardexRoutes(app: FastifyInstance) {
  app.get('/kardex', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.obtener)
}
