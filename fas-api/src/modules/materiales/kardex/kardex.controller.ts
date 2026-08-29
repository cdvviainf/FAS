import type { FastifyRequest, FastifyReply } from 'fastify'
import { kardexQuerySchema } from './kardex.schema.js'
import * as service from './kardex.service.js'

export async function obtener(req: FastifyRequest, reply: FastifyReply) {
  const query = kardexQuerySchema.parse(req.query)
  const data = await service.obtenerKardex(query)
  return reply.send({ data })
}
