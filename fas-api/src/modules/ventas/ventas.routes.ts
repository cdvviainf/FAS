import type { FastifyInstance } from 'fastify'
import { notasVentaRoutes } from './notas-venta/notas-venta.routes.js'
import { embarquesRoutes } from './embarques/embarques.routes.js'
import { proformaRoutes } from './cobranza/proforma.routes.js'

export async function ventasRoutes(app: FastifyInstance) {
  await app.register(notasVentaRoutes)
  await app.register(embarquesRoutes)
  // Proforma de Exportación (Docs/cobranza.md) — prefijo propio /cobranza.
  await app.register(proformaRoutes, { prefix: '/cobranza' })
}
