import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel, requireAnyLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './condiciones-pago.controller.js'

const ITEM = 'CONFIG_CONDICIONES_PAGO'

export async function condicionesPagoRoutes(app: FastifyInstance) {
  // Lectura también desde el Generador DTE (combo de condición de pago de la
  // Factura Nacional manual), sin administración — ver IMP-QA-R1-048.
  app.get('/condiciones-pago', { preHandler: [requireAuth, requireAnyLevel([ITEM, 'GENERADOR_DTE'], 'LECTURA')] }, ctrl.list)
  app.get('/condiciones-pago/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/condiciones-pago', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/condiciones-pago/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
  app.delete('/condiciones-pago/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.remove)
}
