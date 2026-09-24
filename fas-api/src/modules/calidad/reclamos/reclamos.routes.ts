import type { FastifyInstance } from 'fastify'
import { requireAuth, requireAnyLevel, requireLevel, requireReclamosApiKey } from '../../../plugins/auth-guard.js'
import * as ctrl from './reclamos.controller.js'

// Análisis (comentario + documentos) y Veredicto Final/Cierre son exclusivos
// de Calidad — la creación vive en ventas/embarques/embarques.routes.ts.
// Provisión/Valorización son de Comercial, con ítems dedicados. Las lecturas
// compartidas (listar/obtener/provisiones) aceptan CUALQUIERA de los dos
// ítems "de pantalla" (CAL_RECLAMOS o VENTAS_RECLAMOS) porque, desde
// 2026-09-23, Ventas y Calidad son dos pantallas independientes que leen el
// mismo Reclamo (reclamos.md, split Ventas/Calidad).
const ITEM = 'CAL_RECLAMOS'
const ITEM_VENTAS = 'VENTAS_RECLAMOS'
const ITEM_VALORIZACION = 'RECLAMO_VALORIZACION'
const ITEM_CIERRE = 'RECLAMO_CIERRE'
const ITEM_PROVISION = 'RECLAMO_PROVISION'

export async function reclamosRoutes(app: FastifyInstance) {
  app.get('/reclamos', { preHandler: [requireAuth, requireAnyLevel([ITEM, ITEM_VENTAS], 'LECTURA')] }, ctrl.listar)
  app.get('/reclamos/:id', { preHandler: [requireAuth, requireAnyLevel([ITEM, ITEM_VENTAS], 'LECTURA')] }, ctrl.obtener)
  app.patch('/reclamos/:id/analisis', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.actualizarAnalisis)

  app.post('/reclamos/:id/documentos', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.subirDocumento)
  app.get(
    '/reclamos/:id/documentos/:documentoId',
    { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] },
    ctrl.descargarDocumento,
  )
  app.delete(
    '/reclamos/:id/documentos/:documentoId',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    ctrl.eliminarDocumento,
  )

  app.post('/reclamos/:id/valorizar', { preHandler: [requireAuth, requireLevel(ITEM_VALORIZACION, 'TOTAL')] }, ctrl.valorizar)
  app.post(
    '/reclamos/:id/anular-valorizacion',
    { preHandler: [requireAuth, requireLevel(ITEM_VALORIZACION, 'TOTAL')] },
    ctrl.anularValorizacion,
  )
  app.post('/reclamos/:id/cerrar', { preHandler: [requireAuth, requireLevel(ITEM_CIERRE, 'TOTAL')] }, ctrl.cerrar)
  app.post('/reclamos/:id/reabrir', { preHandler: [requireAuth, requireLevel(ITEM_CIERRE, 'TOTAL')] }, ctrl.reabrir)

  // Provisión: crear/reversar exigen permiso específico (RC feedback
  // 2026-09-08) — reversar además valida en el service que quien reversa no
  // sea quien creó (PR3, salvo la reversa automática al valorizar).
  app.post(
    '/reclamos/:id/provisiones',
    { preHandler: [requireAuth, requireLevel(ITEM_PROVISION, 'TOTAL')] },
    ctrl.crearProvision,
  )
  app.get(
    '/reclamos/:id/provisiones',
    { preHandler: [requireAuth, requireAnyLevel([ITEM, ITEM_VENTAS], 'LECTURA')] },
    ctrl.listarProvisiones,
  )
  app.post(
    '/provisiones/:id/reversar',
    { preHandler: [requireAuth, requireLevel(ITEM_PROVISION, 'TOTAL')] },
    ctrl.reversarProvision,
  )
}

// API externa de solo lectura (2026-09-08) — sin sesión de usuario FAS,
// autenticada por secreto compartido (Docs/reclamos.md). Consumida por
// sistemas externos para consultar documentación de un reclamo.
export async function reclamosExternoRoutes(app: FastifyInstance) {
  app.get('/reclamos/:id/documentos', { preHandler: [requireReclamosApiKey] }, ctrl.listarDocumentosExterno)
  app.get(
    '/reclamos/:id/documentos/:documentoId',
    { preHandler: [requireReclamosApiKey] },
    ctrl.descargarDocumentoExterno,
  )
}
