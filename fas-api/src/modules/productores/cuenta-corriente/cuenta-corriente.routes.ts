import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './cuenta-corriente.controller.js'

const ITEM = 'PROD_CTA_CTE'

export async function cuentaCorrienteRoutes(app: FastifyInstance) {
  app.get('/:entidadId/cuenta-corriente', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getInforme)
  app.post('/:entidadId/cuenta-corriente', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.imputar)
}
