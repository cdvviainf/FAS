import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { requireAuth } from '../../plugins/auth-guard.js'
import { getDocumentDefinition } from './documentos.registry.js'
import { getTipoDeDocumentoEmitido } from './documentos.repository.js'
import * as ctrl from './documentos.controller.js'

function nivelCumple(req: FastifyRequest, itemMenu: string, minLevel: 'LECTURA' | 'TOTAL'): boolean {
  const nivel = req.fasAccesos?.get(itemMenu) ?? 'SIN_ACCESO'
  return minLevel === 'LECTURA' ? nivel !== 'SIN_ACCESO' : nivel === 'TOTAL'
}

function forbidden(reply: FastifyReply, minLevel: 'LECTURA' | 'TOTAL') {
  const mensaje = minLevel === 'TOTAL' ? 'Se requiere acceso total para esta operación.' : 'No tiene acceso a esta función.'
  reply.status(403).send({ error: { code: 'FORBIDDEN', message: mensaje } })
}

// El permiso depende del :tipo de la URL (cada documento del registro
// declara su propio itemMenu, Etapa 4 §4) — no se puede resolver de forma
// estática como requireLevel(ITEM, nivel) en las demás rutas del proyecto.
// Mismo criterio que requireLevel (auth-guard.ts): LECTURA para ver/descargar,
// TOTAL para emitir.
function requireNivelDocumento(minLevel: 'LECTURA' | 'TOTAL') {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const { tipo } = req.params as { tipo?: string }
    const def = tipo ? getDocumentDefinition(tipo) : undefined
    if (!def) {
      reply.status(404).send({ error: { code: 'NOT_FOUND', message: `Tipo de documento '${tipo}' no existe.` } })
      return
    }
    if (!nivelCumple(req, def.itemMenu, minLevel)) forbidden(reply, minLevel)
  }
}

// DOC-QA-001 (ronda 1): la reimpresión no tiene :tipo en la URL (va en la
// fila documento_emitido) — sin este guard, `requireAuth` a secas dejaba
// descargar cualquier documento emitido a cualquier usuario autenticado de
// la empresa, sin mirar el itemMenu que declara su registro.
const requireNivelDocumentoEmitido = async (req: FastifyRequest, reply: FastifyReply) => {
  // Fastify ya limpia el sufijo ".pdf" del param (ver documentos.schema.ts).
  const { documentoEmitidoId } = req.params as { documentoEmitidoId?: string }
  const id = documentoEmitidoId ? Number(documentoEmitidoId) : NaN
  const emitido = Number.isFinite(id) ? await getTipoDeDocumentoEmitido(id) : null
  if (!emitido) {
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Documento emitido no existe.' } })
    return
  }
  const def = getDocumentDefinition(emitido.tipo)
  if (!def || !nivelCumple(req, def.itemMenu, 'LECTURA')) forbidden(reply, 'LECTURA')
}

export async function documentosRoutes(app: FastifyInstance) {
  app.get('/:tipo/:id/preview', { preHandler: [requireAuth, requireNivelDocumento('LECTURA')] }, ctrl.preview)
  app.get('/:tipo/:id.pdf', { preHandler: [requireAuth, requireNivelDocumento('LECTURA')] }, ctrl.descargarPdf)
  app.post('/:tipo/:id/emitir', { preHandler: [requireAuth, requireNivelDocumento('TOTAL')] }, ctrl.emitir)
  app.get('/emitidos/:documentoEmitidoId.pdf', { preHandler: [requireAuth, requireNivelDocumentoEmitido] }, ctrl.descargarEmitido)
}
