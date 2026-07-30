import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  notaVentaCreateSchema,
  notaVentaUpdateSchema,
  notaVentaParamsSchema,
  notaVentaListQuerySchema,
  notaVentaDetalleCreateSchema,
  notaVentaDetalleUpdateSchema,
  notaVentaDetalleParamsSchema,
} from './notas-venta.schema.js'
import * as service from './notas-venta.service.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const { page, limit, clienteId } = notaVentaListQuerySchema.parse(req.query)
  const result = await service.listarNotasVenta(page, limit, clienteId)
  return reply.send(result)
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = notaVentaParamsSchema.parse(req.params)
  const notaVenta = await service.obtenerNotaVenta(id)
  return reply.send({ data: notaVenta })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = notaVentaCreateSchema.parse(req.body)
  const notaVenta = await service.crearNotaVenta(body, req.fasUserId!)
  return reply.status(201).send({ data: notaVenta })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = notaVentaParamsSchema.parse(req.params)
  const body = notaVentaUpdateSchema.parse(req.body)
  const notaVenta = await service.actualizarNotaVenta(id, body, req.fasUserId!)
  return reply.send({ data: notaVenta })
}

export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const { id } = notaVentaParamsSchema.parse(req.params)
  await service.eliminarNotaVenta(id, req.fasUserId!)
  return reply.status(204).send()
}

export async function addDetalle(req: FastifyRequest, reply: FastifyReply) {
  const { id } = notaVentaParamsSchema.parse(req.params)
  const body = notaVentaDetalleCreateSchema.parse(req.body)
  const detalle = await service.agregarDetalle(id, body)
  return reply.status(201).send({ data: detalle })
}

export async function updateDetalle(req: FastifyRequest, reply: FastifyReply) {
  const { id, detalleId } = notaVentaDetalleParamsSchema.parse(req.params)
  const body = notaVentaDetalleUpdateSchema.parse(req.body)
  const detalle = await service.actualizarDetalle(id, detalleId, body)
  return reply.send({ data: detalle })
}

export async function removeDetalle(req: FastifyRequest, reply: FastifyReply) {
  const { id, detalleId } = notaVentaDetalleParamsSchema.parse(req.params)
  await service.eliminarDetalle(id, detalleId)
  return reply.status(204).send()
}
