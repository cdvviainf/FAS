import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './factura-nacional.controller.js'

// Factura Nacional (DTE 33/34, Docs/cobranza.md). Primera entrega: desde Proforma
// de Materiales. Mismo ítem de menú FACT_NACIONAL.
const ITEM = 'FACT_NACIONAL'

export async function facturaNacionalRoutes(app: FastifyInstance) {
  // Crear el borrador desde una Proforma de Materiales (body: proformaMaterialId).
  app.post('/facturas-nacional', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.crear)

  app.patch('/facturas-nacional/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.actualizar)
  app.post('/facturas-nacional/:id/enviar-sii', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.enviarSii)
  app.post('/facturas-nacional/:id/firmar', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.firmar)
  app.post('/facturas-nacional/:id/reabrir', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.reabrir)
  app.post('/facturas-nacional/:id/anular', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.anular)

  // Listados (estáticos antes de la paramétrica :id).
  app.get('/facturas-nacional', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/facturas-nacional/proformas-facturables', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.listProformasFacturables)
  app.get('/facturas-nacional/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.get('/facturas-nacional/:id/xml', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.descargarXml)
  app.get('/facturas-nacional/:id/pdf-borrador', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.descargarPdfBorrador)
}
