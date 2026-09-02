import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel, requireAnyLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './instructivo-embalaje.controller.js'

const ITEM = 'COMPRAS_INSTRUCTIVO'
const ITEM_RECEPCION = 'COMPRAS_RECEPCION'
// La lectura es compartida con Recepción (selector de instructivos en modo
// PROCESO, 2026-09-01). Calidad ya no tiene ningún rol sobre el Instructivo
// (2026-09-02: deja de emitir veredicto — ver compras.md §4.1/calidad.md).
const ITEMS_LECTURA = [ITEM, ITEM_RECEPCION]

export async function instructivoEmbalajeRoutes(app: FastifyInstance) {
  app.get('/instructivos-embalaje', { preHandler: [requireAuth, requireAnyLevel(ITEMS_LECTURA, 'LECTURA')] }, ctrl.list)
  app.get('/instructivos-embalaje/:id', { preHandler: [requireAuth, requireAnyLevel(ITEMS_LECTURA, 'LECTURA')] }, ctrl.getById)
  app.post('/instructivos-embalaje', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/instructivos-embalaje/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
  app.delete('/instructivos-embalaje/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.remove)
}
