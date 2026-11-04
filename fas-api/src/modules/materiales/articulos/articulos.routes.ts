import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel, requireAnyLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './articulos.controller.js'

const ITEM = 'MATERIALES_ARTICULOS'

export async function articulosRoutes(app: FastifyInstance) {
  // Lectura también desde el Generador DTE (combo de artículo en el detalle),
  // sin administración de artículos — ver IMP-QA-R1-048.
  app.get('/articulos', { preHandler: [requireAuth, requireAnyLevel([ITEM, 'GENERADOR_DTE'], 'LECTURA')] }, ctrl.list)
  app.get('/articulos/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/articulos', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/articulos/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)

  app.get('/articulos/:id/documentos', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.listDocumentos)
  app.post('/articulos/:id/documentos', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.subirDocumento)
  app.get('/articulos/:id/documentos/:docId/descarga', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.descargarDocumento)
  app.delete('/articulos/:id/documentos/:docId', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.eliminarDocumento)
}
