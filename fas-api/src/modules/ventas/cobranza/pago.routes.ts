import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './pago.controller.js'

// Registro de pagos de cartera (Docs/cobranza.md §6). Ítem de menú VENTAS_COBRANZA.
const ITEM = 'VENTAS_COBRANZA'

export async function pagoRoutes(app: FastifyInstance) {
  // Opciones para los selectores de la pantalla (clientes/monedas), bajo el
  // propio ítem VENTAS_COBRANZA — no exige permisos de los mantenedores de
  // Config (FAS-COB-PAG-R1-003). Estáticas antes de las paramétricas.
  app.get('/clientes', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.listClientes)
  app.get('/monedas', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.listMonedas)

  // Lecturas para armar la pantalla de aplicación de pago.
  app.get('/clientes/:id/documentos-pendientes', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.documentosPendientes)
  app.get('/clientes/:id/saldo-a-favor', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.saldosAFavor)

  // Pagos.
  app.post('/pagos', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.crear)
  app.get('/pagos', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/pagos/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)

  // Aplicar un saldo a favor existente a una factura (CB13).
  app.post('/saldo-a-favor/:id/aplicar', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.aplicarSaldoAFavor)
}
