import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './articulos.controller.js'

const ITEM = 'OPER_MATERIALES'

export async function articulosRoutes(app: FastifyInstance) {
  app.get('/articulos', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/articulos/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/articulos', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/articulos/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)

  app.get('/articulos/:id/documentos', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.listDocumentos)
  app.post('/articulos/:id/documentos', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.subirDocumento)
  app.get('/articulos/:id/documentos/:docId/descarga', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.descargarDocumento)
  app.delete('/articulos/:id/documentos/:docId', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.eliminarDocumento)
}
