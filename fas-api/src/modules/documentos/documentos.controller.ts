import type { FastifyRequest, FastifyReply } from 'fastify'
import { documentoParamsSchema, documentoPdfParamsSchema, documentoEmitidoParamsSchema } from './documentos.schema.js'
import * as service from './documentos.service.js'

function empresaActualOFallar(req: FastifyRequest): number {
  if (req.fasEmpresaId == null) {
    throw new Error('Empresa activa requerida para generar documentos') // el guard de empresa ya corrió antes en requireAuth
  }
  return req.fasEmpresaId
}

export async function preview(req: FastifyRequest, reply: FastifyReply) {
  const { tipo, id } = documentoParamsSchema.parse(req.params)
  const html = await service.obtenerPreviewHtml(tipo, id, empresaActualOFallar(req))
  return reply.header('Content-Type', 'text/html; charset=utf-8').send(html)
}

export async function descargarPdf(req: FastifyRequest, reply: FastifyReply) {
  const { tipo, id } = documentoPdfParamsSchema.parse(req.params)
  const { buffer, nombreArchivo } = await service.obtenerPdf(tipo, id, empresaActualOFallar(req))
  return reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `inline; filename="${encodeURIComponent(nombreArchivo)}"`)
    .header('Content-Length', String(buffer.length))
    .send(buffer)
}

export async function emitir(req: FastifyRequest, reply: FastifyReply) {
  const { tipo, id } = documentoParamsSchema.parse(req.params)
  const resultado = await service.emitirDocumento(tipo, id, empresaActualOFallar(req), req.fasUserId!)
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
