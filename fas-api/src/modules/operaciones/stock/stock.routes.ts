import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './stock.controller.js'

// ItemMenu: "Stock de Fruta", sección Reportes (prisma/seed.ts) — reemplaza a
// OPER_STOCK (2026-08-24).
const ITEM = 'REPORTES_STOCK_FRUTA'

// ItemMenu: "Calificación de Pallets", sección Calidad (2026-09-02,
// compras.md §4.8) — permite editar Nota Calidad/Condición/Completo, a
// diferencia del reporte de arriba que es solo lectura.
const ITEM_GESTION = 'OPERACIONES_GESTION_PALLETS'

export async function stockRoutes(app: FastifyInstance) {
  app.get('/stock', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.listar)

  app.get('/stock/pallets', { preHandler: [requireAuth, requireLevel(ITEM_GESTION, 'LECTURA')] }, ctrl.listar)
  app.patch('/stock/pallets/:id', { preHandler: [requireAuth, requireLevel(ITEM_GESTION, 'TOTAL')] }, ctrl.actualizarPallet)
}
