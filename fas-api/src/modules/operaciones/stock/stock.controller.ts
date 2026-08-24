import type { FastifyRequest, FastifyReply } from 'fastify'
import { stockResumenQuerySchema, stockDetalleQuerySchema } from './stock.schema.js'
import * as service from './stock.service.js'

export async function resumen(req: FastifyRequest, reply: FastifyReply) {
  const filtros = stockResumenQuerySchema.parse(req.query)
  const data = await service.obtenerResumenStock(filtros)
  return reply.send({ data })
}

export async function detalle(req: FastifyRequest, reply: FastifyReply) {
  const filtros = stockDetalleQuerySchema.parse(req.query)
  const data = await service.obtenerDetalleStock(filtros)
  return reply.send({ data })
}
