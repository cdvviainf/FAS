import type { FastifyInstance } from 'fastify'
import { notasVentaRoutes } from './notas-venta/notas-venta.routes.js'
import { embarquesRoutes } from './embarques/embarques.routes.js'

export async function ventasRoutes(app: FastifyInstance) {
  await app.register(notasVentaRoutes)
  await app.register(embarquesRoutes)
}
