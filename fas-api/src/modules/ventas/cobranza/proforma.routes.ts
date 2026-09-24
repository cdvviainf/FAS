import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './proforma.controller.js'

// Proforma de Exportación (Docs/cobranza.md, primera etapa del módulo de
// Facturación/Cobranza — 2026-09-24). Un solo ítem de menú para toda la
// pantalla (lectura/escritura), ya sembrado desde 2026-07-24 sin uso hasta
// ahora.
const ITEM = 'FACT_EXPORTACION'

export async function proformaRoutes(app: FastifyInstance) {
  app.get(
    '/embarques/:id/proforma/sugerencia',
    { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] },
    ctrl.sugerirLineas,
  )
  app.get(
    '/embarques/:id/proforma',
    { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] },
    ctrl.obtenerProformaDelEmbarque,
  )
  app.post('/embarques/:id/proforma', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.emitirProforma)

  app.get('/proformas', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.listar)
  app.get('/proformas/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.obtener)
  app.post('/proformas/:id/anular', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.anular)
}
