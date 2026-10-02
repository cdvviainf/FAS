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
  // Firma SII en dos pasos manuales: enviar borrador (temporal) y firmar (timbrar).
  app.post('/facturas-exportacion/:id/enviar-sii', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.enviarSii)
  app.post('/facturas-exportacion/:id/firmar', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.firmar)
  app.post('/facturas-exportacion/:id/reabrir', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.reabrir)
  app.post('/facturas-exportacion/:id/anular', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.anular)

  app.get('/facturas-exportacion', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.listar)
  // Landing embarque-céntrica: embarques despachados + estado Proforma/Factura.
  app.get('/exportacion/embarques-despachados', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.listarEmbarques)
  app.get('/facturas-exportacion/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.obtener)
  app.get('/facturas-exportacion/:id/xml', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.descargarXml)
  // Diagnóstico: devuelve el payload exacto que se manda a simpleDTE (+ resumen
  // de códigos Aduana) sin enviarlo. Para ver por qué el PDF sale reducido.
  app.get('/facturas-exportacion/:id/payload-dte', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.previsualizarPayloadDte)
  // Tipo de cambio sugerido (dólar/euro observado del Banco Central) para el editor.
  app.get('/facturas-exportacion/:id/tipo-cambio', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.obtenerTipoCambio)
  app.get('/embarques/:id/factura-exportacion', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.obtenerDelEmbarque)
}
