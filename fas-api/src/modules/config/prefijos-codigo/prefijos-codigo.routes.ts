import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './prefijos-codigo.controller.js'

const ITEM = 'CONFIG_PREFIJOS_CODIGO'

export async function prefijosCodigoRoutes(app: FastifyInstance) {
  // Antes del CRUD por :id para que "siguiente" no choque con el param numérico.
  // Solo requireAuth: el "siguiente código" lo consultan formularios de todos los
  // módulos (Perfil, Entidad, Artículo…) al crear un registro; exigir el permiso
  // del mantenedor de Prefijos acá acoplaría permisos cruzados (2026-10-07).
  app.get('/prefijos-codigo/siguiente/:modelo', { preHandler: [requireAuth] }, ctrl.getSiguienteCodigo)

  app.get('/prefijos-codigo', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/prefijos-codigo/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/prefijos-codigo', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/prefijos-codigo/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
  app.delete('/prefijos-codigo/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.remove)
}
