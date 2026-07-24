import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  ordenCompraCreateSchema,
  ordenCompraUpdateSchema,
  ordenCompraParamsSchema,
  ordenCompraListQuerySchema,
} from './ordenes-compra.schema.js'
import * as service from './ordenes-compra.service.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const { page, limit, entidadProductorId, estado } = ordenCompraListQuerySchema.parse(req.query)
  const result = await service.listarOrdenesCompra(page, limit, entidadProductorId, estado)
  return reply.send(result)
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = ordenCompraParamsSchema.parse(req.params)
  const orden = await service.obtenerOrdenCompra(id)
  return reply.send({ data: orden })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = ordenCompraCreateSchema.parse(req.body)
  const orden = await service.crearOrdenCompra(body, req.fasUserId!)
  return reply.status(201).send({ data: orden })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = ordenCompraParamsSchema.parse(req.params)
  const body = ordenCompraUpdateSchema.parse(req.body)
  const orden = await service.actualizarOrdenCompra(id, body, req.fasUserId!)
  return reply.send({ data: orden })
}

export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const { id } = ordenCompraParamsSchema.parse(req.params)
  await service.eliminarOrdenCompra(id, req.fasUserId!)
  return reply.status(204).send()
}
