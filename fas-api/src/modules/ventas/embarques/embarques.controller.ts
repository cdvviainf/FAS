import type { FastifyRequest, FastifyReply } from 'fastify'
import { embarqueCreateSchema, embarqueParamsSchema, embarqueListQuerySchema } from './embarques.schema.js'
import * as service from './embarques.service.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const { notaVentaId } = embarqueListQuerySchema.parse(req.query)
  const embarques = await service.listarEmbarques(notaVentaId)
  return reply.send({ data: embarques })
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const embarque = await service.obtenerEmbarque(id)
  return reply.send({ data: embarque })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = embarqueCreateSchema.parse(req.body)
  const embarque = await service.generarEmbarque(body, req.fasUserId!)
  return reply.status(201).send({ data: embarque })
}
