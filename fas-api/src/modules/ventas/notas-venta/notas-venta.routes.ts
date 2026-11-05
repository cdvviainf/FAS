import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './notas-venta.controller.js'

const ITEM = 'VENTAS_NV' // "Cierre Comercial"

export async function notasVentaRoutes(app: FastifyInstance) {
  app.get('/notas-venta', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.list)
  // Exportador por defecto (EXPORTADORA de la empresa activa) para precargar el form.
  app.get('/notas-venta/exportador-predeterminado', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.exportadorPredeterminado)
  // Responsables de venta para el selector del Cierre (2026-11-05): con el
  // permiso de Cierre Comercial, sin exigir lectura de Configuración→Usuarios.
  app.get('/notas-venta/responsables-venta', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.responsablesVenta)
  app.get('/notas-venta/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.getById)
  app.post('/notas-venta', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.create)
  app.patch('/notas-venta/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.update)
  app.delete('/notas-venta/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.remove)
  // Cerrar/bloquear: permiso normal de Cierre Comercial. Reabrir: permiso
  // especial dedicado (2026-09-28).
  // Duplicar (2026-11-05): crea un Cierre nuevo (abierto) copiando encabezado
  // y líneas — mismo permiso que crear.
  app.post('/notas-venta/:id/duplicar', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.duplicar)
  app.post('/notas-venta/:id/cerrar', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.cerrar)
  app.post('/notas-venta/:id/reabrir', { preHandler: [requireAuth, requireLevel('VENTAS_REABRIR_CIERRE', 'TOTAL')] }, ctrl.reabrir)
  app.post('/notas-venta/:id/detalles', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.addDetalle)
  app.patch('/notas-venta/:id/detalles/:detalleId', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.updateDetalle)
  app.delete('/notas-venta/:id/detalles/:detalleId', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.removeDetalle)
}
