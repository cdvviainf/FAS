import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './prefijos-codigo.controller.js'

const ITEM = 'CONFIG_MANTENEDORES'

export async function prefijosCodigoRoutes(app: FastifyInstance) {
  // Antes del CRUD por :id para que "siguiente" no choque con el param numérico.
  app.get('/prefijos-codigo/siguiente/:modelo', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getSiguienteCodigo)

  app.get('/prefijos-codigo', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/prefijos-codigo/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/prefijos-codigo', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/prefijos-codigo/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
  app.delete('/prefijos-codigo/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.remove)
}
