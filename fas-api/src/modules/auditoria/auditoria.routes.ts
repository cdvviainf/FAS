import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../plugins/auth-guard.js'
import * as ctrl from './auditoria.controller.js'

const ITEM = 'CONFIG_AUDITORIA'

export async function auditoriaRoutes(app: FastifyInstance) {
  // Registro de navegación: cualquier usuario autenticado (se audita a sí mismo).
  app.post('/navegacion', { preHandler: [requireAuth] }, ctrl.registrarNavegacion)

  // Consulta de la bitácora: requiere permiso de lectura del ítem de auditoría.
  app.get('/', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)

  // Facetas (usuarios/entidades de la bitácora) para los filtros — mismo permiso.
  app.get('/facetas', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.facetas)

  // Export CSV de la bitácora filtrada — mismo permiso.
  app.get('/export', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.exportCsv)
}
