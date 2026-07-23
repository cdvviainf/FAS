import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  movimientoCCCreateSchema,
  productorParamsSchema,
  cuentaCorrienteQuerySchema,
} from './cuenta-corriente.schema.js'
import * as service from './cuenta-corriente.service.js'

export async function getInforme(req: FastifyRequest, reply: FastifyReply) {
  const { entidadId } = productorParamsSchema.parse(req.params)
  const query = cuentaCorrienteQuerySchema.parse(req.query)
  const informe = await service.obtenerInforme(entidadId, query)
  return reply.send({ data: informe })
}

export async function imputar(req: FastifyRequest, reply: FastifyReply) {
  const { entidadId } = productorParamsSchema.parse(req.params)
  const body = movimientoCCCreateSchema.parse(req.body)
  const movimiento = await service.imputarMovimiento(entidadId, body, req.fasUserId!)
  return reply.status(201).send({ data: movimiento })
}
