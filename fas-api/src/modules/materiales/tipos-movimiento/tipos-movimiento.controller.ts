import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  tipoMovimientoCreateSchema,
  tipoMovimientoUpdateSchema,
  tipoMovimientoParamsSchema,
  tipoMovimientoListQuerySchema,
} from './tipos-movimiento.schema.js'
import * as service from './tipos-movimiento.service.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const query = tipoMovimientoListQuerySchema.parse(req.query)
  const result = await service.listarTiposMovimiento(query)
  return reply.send(result)
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = tipoMovimientoParamsSchema.parse(req.params)
  const tipo = await service.obtenerTipoMovimiento(id)
  return reply.send({ data: tipo })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = tipoMovimientoCreateSchema.parse(req.body)
  const tipo = await service.crearTipoMovimiento(body)
  return reply.status(201).send({ data: tipo })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = tipoMovimientoParamsSchema.parse(req.params)
  const body = tipoMovimientoUpdateSchema.parse(req.body)
  const tipo = await service.actualizarTipoMovimiento(id, body)
  return reply.send({ data: tipo })
}
