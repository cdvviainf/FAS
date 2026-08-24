import type { FastifyRequest, FastifyReply } from 'fastify'
import * as service from './stock.service.js'

export async function listar(_req: FastifyRequest, reply: FastifyReply) {
  const data = await service.obtenerStock()
  return reply.send({ data })
}
