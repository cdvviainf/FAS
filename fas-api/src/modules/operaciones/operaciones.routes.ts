import type { FastifyInstance } from 'fastify'
import { stockRoutes } from './stock/stock.routes.js'

export async function operacionesRoutes(app: FastifyInstance) {
  await app.register(stockRoutes)
}
