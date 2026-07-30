import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './embarques.controller.js'

const ITEM = 'VENTAS_NV' // Embarque nace desde Cierre Comercial — mismo permiso por ahora

export async function embarquesRoutes(app: FastifyInstance) {
  app.get('/embarques', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/embarques/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/embarques', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
}
