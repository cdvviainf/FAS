import type { FastifyInstance } from 'fastify'
import { requireAuth, requireAnyLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './nota-credito.controller.js'

// Lecturas de la Nota de Crédito de anulación (Ciclo 4). La emisión vive en los
// endpoints de cada factura (.../anular-con-nc). Acá solo lecturas: una NC puede
// ser de exportación o nacional, así que se admite cualquiera de los dos ítems.
const ITEMS = ['FACT_EXPORTACION', 'FACT_NACIONAL']

export async function notaCreditoRoutes(app: FastifyInstance) {
  app.get('/notas-credito/:id', { preHandler: [requireAuth, requireAnyLevel(ITEMS, 'LECTURA')] }, ctrl.getById)
  app.get('/notas-credito/:id/xml', { preHandler: [requireAuth, requireAnyLevel(ITEMS, 'LECTURA')] }, ctrl.descargarXml)
  app.get('/notas-credito/:id/pdf', { preHandler: [requireAuth, requireAnyLevel(ITEMS, 'LECTURA')] }, ctrl.descargarPdf)
}
