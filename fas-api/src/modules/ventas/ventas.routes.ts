import type { FastifyInstance } from 'fastify'
import { notasVentaRoutes } from './notas-venta/notas-venta.routes.js'
import { embarquesRoutes } from './embarques/embarques.routes.js'
import { proformaRoutes } from './cobranza/proforma.routes.js'
import { facturaExportacionRoutes } from './cobranza/factura-exportacion.routes.js'
import { facturaNacionalRoutes } from './cobranza/factura-nacional.routes.js'
import { pagoRoutes } from './cobranza/pago.routes.js'
import { notaCreditoRoutes } from './cobranza/nota-credito.routes.js'

export async function ventasRoutes(app: FastifyInstance) {
  await app.register(notasVentaRoutes)
  await app.register(embarquesRoutes)
  // Proforma + Factura de Exportación (Docs/cobranza.md) — prefijo propio /cobranza.
  await app.register(proformaRoutes, { prefix: '/cobranza' })
  await app.register(facturaExportacionRoutes, { prefix: '/cobranza' })
  await app.register(facturaNacionalRoutes, { prefix: '/cobranza' })
  // Registro de pagos de cartera (Ciclo 2, Docs/cobranza.md §6).
  await app.register(pagoRoutes, { prefix: '/cobranza' })
  // Notas de Crédito de anulación (Ciclo 4) — lecturas (la emisión vive en cada factura).
  await app.register(notaCreditoRoutes, { prefix: '/cobranza' })
}
