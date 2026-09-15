import type { FastifyRequest, FastifyReply } from 'fastify'
import * as service from './cajas-por-pallet.service.js'
import {
  cajasPorPalletCreateSchema,
  cajasPorPalletUpdateSchema,
  cajasPorPalletParamsSchema,
  cajasPorPalletBuscarSchema,
  cajasPorPalletListSchema,
  cajasPorPalletMatrizSchema,
  cajasPorPalletUpsertSchema,
} from './cajas-por-pallet.schema.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const filters = cajasPorPalletListSchema.parse(req.query)
  const result = await service.listar(filters)
  return reply.send(result)
}

export async function buscar(req: FastifyRequest, reply: FastifyReply) {
  const { articuloId, tipoPalletId } = cajasPorPalletBuscarSchema.parse(req.query)
  const data = await service.buscar(articuloId, tipoPalletId)
  return reply.send({ data })
}

export async function matriz(req: FastifyRequest, reply: FastifyReply) {
  const { especieId, tipoPalletId } = cajasPorPalletMatrizSchema.parse(req.query)
  const data = await service.matriz(especieId, tipoPalletId)
  return reply.send({ data })
}

export async function upsert(req: FastifyRequest, reply: FastifyReply) {
  const body = cajasPorPalletUpsertSchema.parse(req.body)
  const data = await service.upsertPorPar(body.articuloId, body.tipoPalletId, body.cajasPorPallet, req.fasUserId!)
  return reply.send({ data })
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = cajasPorPalletParamsSchema.parse(req.params)
  const data = await service.obtener(id)
  return reply.send({ data })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = cajasPorPalletCreateSchema.parse(req.body)
  const data = await service.crear(body, req.fasUserId!)
  return reply.status(201).send({ data })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = cajasPorPalletParamsSchema.parse(req.params)
  const body = cajasPorPalletUpdateSchema.parse(req.body)
  const data = await service.actualizar(id, body, req.fasUserId!)
  return reply.send({ data })
}

export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const { id } = cajasPorPalletParamsSchema.parse(req.params)
  await service.eliminar(id, req.fasUserId!)
  return reply.status(204).send()
}
