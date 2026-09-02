import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  embarqueCreateSchema,
  embarqueParamsSchema,
  embarqueListQuerySchema,
  reservarPalletsSchema,
  embarquePalletParamsSchema,
} from './embarques.schema.js'
import * as service from './embarques.service.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const { page, limit, notaVentaId } = embarqueListQuerySchema.parse(req.query)
  const result = await service.listarEmbarques(page, limit, notaVentaId)
  return reply.send(result)
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const embarque = await service.obtenerEmbarque(id)
  return reply.send({ data: embarque })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = embarqueCreateSchema.parse(req.body)
  const embarque = await service.generarEmbarque(body, req.fasUserId!)
  return reply.status(201).send({ data: embarque })
}

// ─── Seleccionar Pallets ────────────────────────────────────────────────────

export async function listarPalletsDisponibles(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const data = await service.listarPalletsDisponibles(id)
  return reply.send({ data })
}

export async function agregarPallets(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const { palletIds } = reservarPalletsSchema.parse(req.body)
  const embarque = await service.agregarPallets(id, palletIds)
  return reply.status(201).send({ data: embarque })
}

export async function quitarPallet(req: FastifyRequest, reply: FastifyReply) {
  const { id, palletId } = embarquePalletParamsSchema.parse(req.params)
  const embarque = await service.quitarPallet(id, palletId)
  return reply.send({ data: embarque })
}

// ─── Despachar ──────────────────────────────────────────────────────────────

export async function despachar(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const embarque = await service.confirmarDespacho(id, req.fasUserId!)
  return reply.send({ data: embarque })
}
