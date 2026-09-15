import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './cajas-por-pallet.controller.js'

const ITEM = 'CONFIG_CAJAS_POR_PALLET'

export async function cajasPorPalletRoutes(app: FastifyInstance) {
  // Lookup para auto-completar cajasPorPallet en OC/Instructivo/NV: solo exige
  // sesión (lo usan usuarios de Compras/Ventas, no del mantenedor). Antes del
  // :id para no colisionar con el param numérico.
  app.get('/cajas-por-pallet/buscar', { preHandler: [requireAuth] }, ctrl.buscar)

  // Editor matriz: embalajes de una especie con su cantidad para un tipo de pallet.
  app.get('/cajas-por-pallet/matriz', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.matriz)
  app.post('/cajas-por-pallet/upsert', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.upsert)

  app.get('/cajas-por-pallet', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  app.get('/cajas-por-pallet/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/cajas-por-pallet', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/cajas-por-pallet/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
  app.delete('/cajas-por-pallet/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.remove)
}
