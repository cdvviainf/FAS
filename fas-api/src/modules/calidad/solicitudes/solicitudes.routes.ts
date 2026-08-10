import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel, requireAnyLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './solicitudes.controller.js'

// Compras gestiona (ingresar/editar/notificar/eliminar/reabrir), Calidad solo
// ve y cierra (2026-08-10, ver Docs/Hallazgos/solicitud-inspeccion.md). Ambos
// ítems dan acceso de lectura al mismo recurso.
const ITEM_COMPRAS = 'COMPRAS_SOLICITUDES'
const ITEM_CALIDAD = 'CAL_SOLICITUDES'
const ITEMS_LECTURA = [ITEM_COMPRAS, ITEM_CALIDAD]

export async function solicitudesRoutes(app: FastifyInstance) {
  // Lectura — ambos ítems (Compras y Calidad) ven el mismo recurso.
  app.get('/solicitudes', { preHandler: [requireAuth, requireAnyLevel(ITEMS_LECTURA, 'LECTURA')] }, ctrl.list)
  app.get('/solicitudes/:id', { preHandler: [requireAuth, requireAnyLevel(ITEMS_LECTURA, 'LECTURA')] }, ctrl.getById)
  app.get('/solicitudes/:id/adjuntos/:adjuntoId/descarga', { preHandler: [requireAuth, requireAnyLevel(ITEMS_LECTURA, 'LECTURA')] }, ctrl.descargarAdjunto)

  // Escritura — exclusiva de Compras (Calidad quedó restringida a ver+cerrar).
  app.post('/solicitudes', { preHandler: [requireAuth, requireLevel(ITEM_COMPRAS, 'TOTAL')] }, ctrl.create)
  app.patch('/solicitudes/:id', { preHandler: [requireAuth, requireLevel(ITEM_COMPRAS, 'TOTAL')] }, ctrl.update)
  app.delete('/solicitudes/:id', { preHandler: [requireAuth, requireLevel(ITEM_COMPRAS, 'TOTAL')] }, ctrl.remove)
  app.post('/solicitudes/:id/notificar', { preHandler: [requireAuth, requireLevel(ITEM_COMPRAS, 'TOTAL')] }, ctrl.notificar)
  app.post('/solicitudes/:id/reabrir', { preHandler: [requireAuth, requireLevel(ITEM_COMPRAS, 'TOTAL')] }, ctrl.reabrir)

  // Cerrar y adjuntar: basta LECTURA en cualquiera de los dos ítems — el
  // service exige además ser asignado ACUDIR (o tener nivel TOTAL en
  // cualquiera de los dos) para cerrar. Un inspector puede tener solo lectura
  // del módulo y aun así completar su inspección.
  app.post('/solicitudes/:id/cerrar', { preHandler: [requireAuth, requireAnyLevel(ITEMS_LECTURA, 'LECTURA')] }, ctrl.cerrar)
  app.post('/solicitudes/:id/adjuntos', { preHandler: [requireAuth, requireAnyLevel(ITEMS_LECTURA, 'LECTURA')] }, ctrl.subirAdjunto)
  app.delete('/solicitudes/:id/adjuntos/:adjuntoId', { preHandler: [requireAuth, requireAnyLevel(ITEMS_LECTURA, 'LECTURA')] }, ctrl.eliminarAdjunto)
}
