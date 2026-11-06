import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './correo.controller.js'

// SMTP por empresa: se administra en Empresas › SMTP (2026-11-06 se eliminó la
// pantalla Configuración General y su ítem CONFIG_GENERAL).
const ITEM = 'CONFIG_EMPRESAS'

export async function correoRoutes(app: FastifyInstance) {
  app.get('/correo', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getConfiguracion)
  app.put('/correo', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.putConfiguracion)
  app.post('/correo/probar', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.postProbar)
}
