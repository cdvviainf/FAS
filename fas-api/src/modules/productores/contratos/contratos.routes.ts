import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './contratos.controller.js'

const ITEM = 'PROD_CONTRATO'

export async function contratosRoutes(app: FastifyInstance) {
  app.get('/:entidadId/contratos', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/:entidadId/contratos/:contratoId', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/:entidadId/contratos', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/:entidadId/contratos/:contratoId', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
  app.delete('/:entidadId/contratos/:contratoId', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.remove)

  app.post('/:entidadId/contratos/:contratoId/pdf', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.subirPdf)
  app.get('/:entidadId/contratos/:contratoId/pdf', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.descargarPdf)
}
