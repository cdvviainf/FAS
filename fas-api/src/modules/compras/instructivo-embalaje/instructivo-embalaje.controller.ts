import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  instructivoEmbalajeCreateSchema,
  instructivoEmbalajeUpdateSchema,
  instructivoEmbalajeParamsSchema,
  instructivoEmbalajeListQuerySchema,
} from './instructivo-embalaje.schema.js'
import * as service from './instructivo-embalaje.service.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const { page, limit, notaVentaId } = instructivoEmbalajeListQuerySchema.parse(req.query)
  const result = await service.listarInstructivos(page, limit, notaVentaId)
  return reply.send(result)
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = instructivoEmbalajeParamsSchema.parse(req.params)
  const instructivo = await service.obtenerInstructivo(id)
  return reply.send({ data: instructivo })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = instructivoEmbalajeCreateSchema.parse(req.body)
  const instructivo = await service.crearInstructivo(body, req.fasUserId!)
  return reply.status(201).send({ data: instructivo })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = instructivoEmbalajeParamsSchema.parse(req.params)
  const body = instructivoEmbalajeUpdateSchema.parse(req.body)
  const instructivo = await service.actualizarInstructivo(id, body)
  return reply.send({ data: instructivo })
}
