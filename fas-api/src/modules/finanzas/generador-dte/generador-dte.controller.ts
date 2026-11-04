import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  documentoManualCreateSchema,
  documentoManualUpdateSchema,
  documentoManualParamsSchema,
  documentoManualListQuerySchema,
} from './generador-dte.schema.js'
import * as service from './generador-dte.service.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const { page, limit, q, claseDocumento, estado, entidadId } = documentoManualListQuerySchema.parse(req.query)
  return reply.send(await service.listarDocumentosManuales({ page, limit, q, claseDocumento, estado, entidadId }))
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = documentoManualParamsSchema.parse(req.params)
  return reply.send({ data: await service.obtenerDocumentoManual(id) })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = documentoManualCreateSchema.parse(req.body)
  const doc = await service.crearDocumentoManual(body, req.fasUserId!)
  return reply.status(201).send({ data: doc })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = documentoManualParamsSchema.parse(req.params)
  const body = documentoManualUpdateSchema.parse(req.body)
  const doc = await service.actualizarDocumentoManual(id, body)
  return reply.send({ data: doc })
}

export async function anular(req: FastifyRequest, reply: FastifyReply) {
  const { id } = documentoManualParamsSchema.parse(req.params)
  const doc = await service.anularDocumentoManual(id, req.fasUserId!)
  return reply.send({ data: doc })
}

export async function descargarPdfBorrador(req: FastifyRequest, reply: FastifyReply) {
  const { id } = documentoManualParamsSchema.parse(req.params)
  const { buffer, nombreArchivo } = await service.obtenerPdfBorrador(id)
  return reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `inline; filename="${nombreArchivo}"`)
    .send(buffer)
}
