import type { FastifyInstance } from 'fastify'
import { articulosRoutes } from './articulos/articulos.routes.js'
import { recetasRoutes } from './recetas/recetas.routes.js'
import { tiposMovimientoRoutes } from './tipos-movimiento/tipos-movimiento.routes.js'
import { movimientosRoutes } from './movimientos/movimientos.routes.js'

export async function materialesRoutes(app: FastifyInstance) {
  await app.register(articulosRoutes)
  await app.register(recetasRoutes)
  await app.register(tiposMovimientoRoutes)
  await app.register(movimientosRoutes)
}
