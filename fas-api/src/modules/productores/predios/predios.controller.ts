import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  predioCreateSchema,
  predioUpdateSchema,
  predioParamsSchema,
  productorParamsSchema,
} from './predios.schema.js'
import * as service from './predios.service.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const { entidadId } = productorParamsSchema.parse(req.params)
  const predios = await service.listarPredios(entidadId)
  return reply.send({ data: predios })
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { entidadId, predioId } = predioParamsSchema.parse(req.params)
  const predio = await service.obtenerPredio(entidadId, predioId)
  return reply.send({ data: predio })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const { entidadId } = productorParamsSchema.parse(req.params)
  const body = predioCreateSchema.parse(req.body)
  const predio = await service.crearPredio(entidadId, body, req.fasUserId!)
  return reply.status(201).send({ data: predio })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { entidadId, predioId } = predioParamsSchema.parse(req.params)
  const body = predioUpdateSchema.parse(req.body)
  const predio = await service.actualizarPredio(entidadId, predioId, body, req.fasUserId!)
  return reply.send({ data: predio })
}

export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const { entidadId, predioId } = predioParamsSchema.parse(req.params)
  await service.eliminarPredio(entidadId, predioId, req.fasUserId!)
  return reply.status(204).send()
}
