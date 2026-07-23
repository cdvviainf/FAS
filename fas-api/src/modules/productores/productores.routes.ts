import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../plugins/auth-guard.js'
import * as ctrl from './productores.controller.js'
import { prediosRoutes } from './predios/predios.routes.js'
import { contratosRoutes } from './contratos/contratos.routes.js'
import { cuentaCorrienteRoutes } from './cuenta-corriente/cuenta-corriente.routes.js'

const ITEM = 'PROD_FICHA'

export async function productoresRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/:entidadId', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getFicha)

  await app.register(prediosRoutes)
  await app.register(contratosRoutes)
  await app.register(cuentaCorrienteRoutes)
}
