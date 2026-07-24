import type { FastifyInstance } from 'fastify'
import { instructivoEmbalajeRoutes } from './instructivo-embalaje/instructivo-embalaje.routes.js'

export async function comprasRoutes(app: FastifyInstance) {
  await app.register(instructivoEmbalajeRoutes)
}
