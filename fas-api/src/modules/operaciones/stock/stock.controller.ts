import type { FastifyRequest, FastifyReply } from 'fastify'
import { palletUpdateSchema, palletParamsSchema } from './stock.schema.js'
import * as service from './stock.service.js'

export async function listar(_req: FastifyRequest, reply: FastifyReply) {
  const data = await service.obtenerStock()
  return reply.send({ data })
}

export async function actualizarPallet(req: FastifyRequest, reply: FastifyReply) {
  const { id } = palletParamsSchema.parse(req.params)
  const body = palletUpdateSchema.parse(req.body)
  const pallet = await service.actualizarPallet(id, body)
  return reply.send({ data: pallet })
}
