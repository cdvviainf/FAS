import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  ordenCompraCreateSchema,
  ordenCompraUpdateSchema,
  ordenCompraParamsSchema,
  ordenCompraListQuerySchema,
  ordenCompraLineaCreateSchema,
  ordenCompraLineaUpdateSchema,
  ordenCompraLineaParamsSchema,
  disponibilidadCierreParamsSchema,
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

export async function addLinea(req: FastifyRequest, reply: FastifyReply) {
  const { id } = ordenCompraParamsSchema.parse(req.params)
  const body = ordenCompraLineaCreateSchema.parse(req.body)
  const linea = await service.agregarLinea(id, body)
  return reply.status(201).send({ data: linea })
}

export async function updateLinea(req: FastifyRequest, reply: FastifyReply) {
  const { id, lineaId } = ordenCompraLineaParamsSchema.parse(req.params)
  const body = ordenCompraLineaUpdateSchema.parse(req.body)
  const linea = await service.actualizarLinea(id, lineaId, body)
  return reply.send({ data: linea })
}

export async function removeLinea(req: FastifyRequest, reply: FastifyReply) {
  const { id, lineaId } = ordenCompraLineaParamsSchema.parse(req.params)
  await service.eliminarLinea(id, lineaId)
  return reply.status(204).send()
}

export async function disponibilidadCierre(req: FastifyRequest, reply: FastifyReply) {
  const { notaVentaId } = disponibilidadCierreParamsSchema.parse(req.params)
  const data = await service.obtenerDisponibilidadCierre(notaVentaId)
  return reply.send({ data })
}
