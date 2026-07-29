import type { FastifyInstance } from 'fastify'
import { instructivoEmbalajeRoutes } from './instructivo-embalaje/instructivo-embalaje.routes.js'
import { ordenesCompraRoutes } from './ordenes-compra/ordenes-compra.routes.js'
import { recepcionesRoutes } from './recepciones/recepciones.routes.js'

export async function comprasRoutes(app: FastifyInstance) {
  await app.register(instructivoEmbalajeRoutes)
  await app.register(ordenesCompraRoutes)
  await app.register(recepcionesRoutes)
}
