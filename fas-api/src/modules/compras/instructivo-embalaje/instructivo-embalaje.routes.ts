import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel, requireAnyLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './instructivo-embalaje.controller.js'

const ITEM = 'COMPRAS_INSTRUCTIVO'
const ITEM_CALIDAD = 'CAL_SOLICITUDES'
// El Instructivo lo crea/edita Compras (COMPRAS_INSTRUCTIVO), pero también es
// la Inspección de Proceso que gestiona Calidad (CAL_SOLICITUDES, SQ3). La
// lectura es compartida; el veredicto y los folios son acciones de Calidad.
const ITEMS_LECTURA = [ITEM, ITEM_CALIDAD]

export async function instructivoEmbalajeRoutes(app: FastifyInstance) {
  app.get('/instructivos-embalaje', { preHandler: [requireAuth, requireAnyLevel(ITEMS_LECTURA, 'LECTURA')] }, ctrl.list)
  app.get('/instructivos-embalaje/:id', { preHandler: [requireAuth, requireAnyLevel(ITEMS_LECTURA, 'LECTURA')] }, ctrl.getById)
  app.post('/instructivos-embalaje', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/instructivos-embalaje/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
  app.delete('/instructivos-embalaje/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.remove)

  // ─── Inspección de Proceso (Calidad) ──────────────────────────────────────
  app.patch(
    '/instructivos-embalaje/:id/inspeccion/notificar',
    { preHandler: [requireAuth, requireLevel(ITEM_CALIDAD, 'TOTAL')] },
    ctrl.notificarInspeccion,
  )
  app.patch(
    '/instructivos-embalaje/:id/inspeccion/aprobar',
    { preHandler: [requireAuth, requireLevel(ITEM_CALIDAD, 'TOTAL')] },
    ctrl.aprobarInspeccion,
  )
  app.patch(
    '/instructivos-embalaje/:id/inspeccion/rechazar',
    { preHandler: [requireAuth, requireLevel(ITEM_CALIDAD, 'TOTAL')] },
    ctrl.rechazarInspeccion,
  )
  app.patch(
    '/instructivos-embalaje/:id/inspeccion/cerrar',
    { preHandler: [requireAuth, requireLevel(ITEM_CALIDAD, 'TOTAL')] },
    ctrl.cerrarInspeccion,
  )
  app.post(
    '/instructivos-embalaje/:id/folios',
    { preHandler: [requireAuth, requireLevel(ITEM_CALIDAD, 'TOTAL')] },
    ctrl.agregarFolios,
  )
  app.delete(
    '/instructivos-embalaje/:id/folios/:folioId',
    { preHandler: [requireAuth, requireLevel(ITEM_CALIDAD, 'TOTAL')] },
    ctrl.quitarFolio,
  )
}
