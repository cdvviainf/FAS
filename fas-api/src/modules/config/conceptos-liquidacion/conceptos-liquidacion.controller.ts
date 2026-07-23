import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  conceptoLiquidacionCreateSchema,
  conceptoLiquidacionUpdateSchema,
  conceptoLiquidacionParamsSchema,
} from './conceptos-liquidacion.schema.js'
import * as service from './conceptos-liquidacion.service.js'

export async function list(_req: FastifyRequest, reply: FastifyReply) {
  const conceptos = await service.listarConceptos()
  return reply.send({ data: conceptos })
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = conceptoLiquidacionParamsSchema.parse(req.params)
  const concepto = await service.obtenerConcepto(id)
  return reply.send({ data: concepto })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = conceptoLiquidacionCreateSchema.parse(req.body)
  const concepto = await service.crearConcepto(body, req.fasUserId!)
  return reply.status(201).send({ data: concepto })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = conceptoLiquidacionParamsSchema.parse(req.params)
  const body = conceptoLiquidacionUpdateSchema.parse(req.body)
  const concepto = await service.actualizarConcepto(id, body, req.fasUserId!)
  return reply.send({ data: concepto })
}

export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const { id } = conceptoLiquidacionParamsSchema.parse(req.params)
  await service.eliminarConcepto(id, req.fasUserId!)
  return reply.status(204).send()
}
