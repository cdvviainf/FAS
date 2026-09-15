import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './templates-carga.controller.js'

const ITEM = 'CONFIG_MANTENEDORES'

export async function templatesCargaRoutes(app: FastifyInstance) {
  app.get('/templates-carga', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/templates-carga/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  // Descarga el Excel en blanco (formato base) con las columnas del template.
  app.get('/templates-carga/:id/formato-base', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.descargarFormatoBase)
  app.post('/templates-carga', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/templates-carga/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
  app.delete('/templates-carga/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.remove)
}
