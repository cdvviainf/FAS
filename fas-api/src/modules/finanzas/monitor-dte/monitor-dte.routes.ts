import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './monitor-dte.controller.js'

// Monitor DTE (2026-11-07): documentos electrónicos firmados y su estado SII.
// Con LECTURA se puede ver, descargar y consultar el estado (la consulta solo
// lee el veredicto del SII; no emite ni modifica el documento).
const ITEM = 'FACT_MONITOR_DTE'

export async function monitorDteRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.post('/:id/consultar-sii', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.consultarEstadoSii)
  app.get('/:id/xml', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.descargarXml)
  app.get('/:id/pdf', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.descargarPdf)
}
