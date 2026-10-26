import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './carga-recetas.controller.js'

const ITEM = 'MATERIALES_CARGA_RECETAS'

export async function cargaRecetasRoutes(app: FastifyInstance) {
  // Descargar el Excel base (2 hojas: Recetas + RecetasDetalle).
  app.get('/carga-recetas/template', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.descargarTemplate)

  // Validar (dry-run, no escribe): nivel LECTURA.
  app.post('/carga-recetas/validar', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.validar)

  // Cargar a la base: nivel TOTAL.
  app.post('/carga-recetas', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.cargar)

  // Descargar el reporte de errores (Excel) de una validación: nivel LECTURA.
  app.post('/carga-recetas/reporte', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.descargarReporte)
}
