import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './generador-dte.controller.js'

// Generador DTE — digitación manual de documentos electrónicos (2026-11-04).
// Fase 1: solo BORRADOR + PDF preview. Ítem de menú propio GENERADOR_DTE.
const ITEM = 'GENERADOR_DTE'

export async function generadorDteRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.get('/:id/pdf-borrador', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.descargarPdfBorrador)
  app.post('/', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
  app.post('/:id/anular', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.anular)
}
