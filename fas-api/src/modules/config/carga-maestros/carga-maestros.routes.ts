import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import * as ctrl from './carga-maestros.controller.js'

const ITEM = 'CONFIG_CARGA_MASIVA'

export async function cargaMaestrosRoutes(app: FastifyInstance) {
  // Descargar el Excel base vacío (lectura basta).
  app.get('/carga-maestros/template', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.descargarTemplate)

  // Validar (dry-run) o cargar (?commit=true) el archivo subido.
  app.post('/carga-maestros', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, ctrl.procesar)

  // Descargar el reporte de errores (Excel) de una validación del archivo subido.
  app.post('/carga-maestros/reporte', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, ctrl.descargarReporte)
}
