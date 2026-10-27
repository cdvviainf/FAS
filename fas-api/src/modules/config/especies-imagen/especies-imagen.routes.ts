import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './especies-imagen.controller.js'

const ITEM = 'CONFIG_ESPECIES'

export async function especiesImagenRoutes(app: FastifyInstance) {
  app.get('/especies/:id/imagen', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.descargarImagen)
  app.post('/especies/:id/imagen', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.subirImagen)
  app.delete('/especies/:id/imagen', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.eliminarImagen)
}
