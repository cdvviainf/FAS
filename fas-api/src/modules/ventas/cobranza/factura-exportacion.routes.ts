import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './factura-exportacion.controller.js'

// Factura de Exportación (DTE 110, Docs/cobranza.md §1). Misma pantalla y mismo
// ítem de menú que la Proforma (Facturación → Exportación).
const ITEM = 'FACT_EXPORTACION'

export async function facturaExportacionRoutes(app: FastifyInstance) {
  // Crear el borrador desde una Proforma emitida (:id = proformaId).
  app.post('/proformas/:id/factura-exportacion', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.crearDesdeProforma)

  app.patch('/facturas-exportacion/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.actualizar)
  app.post('/facturas-exportacion/:id/emitir', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.emitir)
  app.post('/facturas-exportacion/:id/anular', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.anular)

  app.get('/facturas-exportacion', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.listar)
  app.get('/facturas-exportacion/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.obtener)
  app.get('/embarques/:id/factura-exportacion', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.obtenerDelEmbarque)
}
