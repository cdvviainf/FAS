import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './carga-entidades-detalle.controller.js'

// Comparte el ítem de menú de la Carga Masiva (mismo permiso).
const ITEM = 'CONFIG_CARGA_MASIVA'

export async function cargaEntidadesDetalleRoutes(app: FastifyInstance) {
  // Descargar el Excel (con hojas de referencia pobladas).
  app.get('/carga-entidades-detalle/template', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.descargarTemplate)

  // Validar (dry-run) o cargar (?commit=true) el archivo subido.
  app.post('/carga-entidades-detalle', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.procesar)

  // Descargar el reporte de errores (Excel) de una validación del archivo subido.
  app.post('/carga-entidades-detalle/reporte', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.descargarReporte)
}
