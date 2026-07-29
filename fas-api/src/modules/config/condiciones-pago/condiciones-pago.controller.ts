import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  condicionPagoCreateSchema,
  condicionPagoUpdateSchema,
  condicionPagoParamsSchema,
  condicionPagoListQuerySchema,
} from './condiciones-pago.schema.js'
import * as service from './condiciones-pago.service.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const { q, tipo } = condicionPagoListQuerySchema.parse(req.query)
  const condicionesPago = await service.listarCondicionesPago(q, tipo)
  return reply.send({ data: condicionesPago })
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = condicionPagoParamsSchema.parse(req.params)
  const condicionPago = await service.obtenerCondicionPago(id)
  return reply.send({ data: condicionPago })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = condicionPagoCreateSchema.parse(req.body)
  const condicionPago = await service.crearCondicionPago(body, req.fasUserId!)
  return reply.status(201).send({ data: condicionPago })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = condicionPagoParamsSchema.parse(req.params)
  const body = condicionPagoUpdateSchema.parse(req.body)
  const condicionPago = await service.actualizarCondicionPago(id, body, req.fasUserId!)
  return reply.send({ data: condicionPago })
}

export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const { id } = condicionPagoParamsSchema.parse(req.params)
  await service.eliminarCondicionPago(id, req.fasUserId!)
  return reply.status(204).send()
}
