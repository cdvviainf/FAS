import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  clienteParamsSchema,
  crearPagoSchema,
  documentosPendientesQuerySchema,
  pagoParamsSchema,
  pagosListQuerySchema,
  saldoAFavorParamsSchema,
  aplicarSaldoAFavorSchema,
} from './pago.schema.js'
import * as service from './pago.service.js'

export async function documentosPendientes(req: FastifyRequest, reply: FastifyReply) {
  const { id } = clienteParamsSchema.parse(req.params)
  const { monedaId } = documentosPendientesQuerySchema.parse(req.query)
  return reply.send({ data: await service.documentosPendientes(id, monedaId) })
}

export async function crear(req: FastifyRequest, reply: FastifyReply) {
  const body = crearPagoSchema.parse(req.body)
  const pago = await service.crearPago(body, req.fasUserId!)
  return reply.status(201).send({ data: pago })
}

export async function listClientes(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send({ data: await service.listarClientes() })
}

export async function listMonedas(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send({ data: await service.listarMonedas() })
}

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const filters = pagosListQuerySchema.parse(req.query)
  return reply.send(await service.listarPagos(filters))
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = pagoParamsSchema.parse(req.params)
  return reply.send({ data: await service.obtenerPago(id) })
}

export async function saldosAFavor(req: FastifyRequest, reply: FastifyReply) {
  const { id } = clienteParamsSchema.parse(req.params)
  return reply.send({ data: await service.saldosAFavor(id) })
}

export async function aplicarSaldoAFavor(req: FastifyRequest, reply: FastifyReply) {
  const { id } = saldoAFavorParamsSchema.parse(req.params)
  const body = aplicarSaldoAFavorSchema.parse(req.body)
  return reply.send({ data: await service.aplicarSaldoAFavor(id, body) })
}
