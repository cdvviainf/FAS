import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { documentoParamsSchema, documentoPdfParamsSchema, documentoEmitidoParamsSchema } from './documentos.schema.js'
import type { IdiomaDocumento } from './documentos.types.js'
import * as service from './documentos.service.js'

function empresaActualOFallar(req: FastifyRequest): number {
  if (req.fasEmpresaId == null) {
    throw new Error('Empresa activa requerida para generar documentos') // el guard de empresa ya corrió antes en requireAuth
  }
  return req.fasEmpresaId
}

// Idioma del PDF por query (?idioma=EN|ES). Ausente → ES; un valor fuera del
// contrato (p. ej. "FR") es error de validación, no se traga como ES.
const idiomaQuerySchema = z.object({ idioma: z.enum(['ES', 'EN']).optional() })
function idiomaDeQuery(req: FastifyRequest): IdiomaDocumento {
  return idiomaQuerySchema.parse(req.query).idioma ?? 'ES'
}

export async function preview(req: FastifyRequest, reply: FastifyReply) {
  const { tipo, id } = documentoParamsSchema.parse(req.params)
  const html = await service.obtenerPreviewHtml(tipo, id, empresaActualOFallar(req), idiomaDeQuery(req))
  return reply.header('Content-Type', 'text/html; charset=utf-8').send(html)
}

export async function descargarPdf(req: FastifyRequest, reply: FastifyReply) {
  const { tipo, id } = documentoPdfParamsSchema.parse(req.params)
  const { buffer, nombreArchivo } = await service.obtenerPdf(tipo, id, empresaActualOFallar(req), idiomaDeQuery(req))
  return reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `inline; filename="${encodeURIComponent(nombreArchivo)}"`)
    .header('Content-Length', String(buffer.length))
    .send(buffer)
}

export async function emitir(req: FastifyRequest, reply: FastifyReply) {
  const { tipo, id } = documentoParamsSchema.parse(req.params)
  const resultado = await service.emitirDocumento(tipo, id, empresaActualOFallar(req), req.fasUserId!, idiomaDeQuery(req))
  return reply
    .status(201)
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `inline; filename="${encodeURIComponent(resultado.nombreArchivo)}"`)
    .header('X-Documento-Emitido-Id', String(resultado.id))
    .header('Content-Length', String(resultado.buffer.length))
    .send(resultado.buffer)
}

export async function descargarEmitido(req: FastifyRequest, reply: FastifyReply) {
  const { documentoEmitidoId } = documentoEmitidoParamsSchema.parse(req.params)
  const { buffer, nombreArchivo } = await service.obtenerPdfEmitido(documentoEmitidoId)
  return reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `inline; filename="${encodeURIComponent(nombreArchivo)}"`)
    .header('Content-Length', String(buffer.length))
    .send(buffer)
}
