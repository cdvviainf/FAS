import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  movimientoCreateSchema,
  movimientoParamsSchema,
  movimientoListQuerySchema,
} from './movimientos.schema.js'
import * as service from './movimientos.service.js'
import { z } from 'zod'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const query = movimientoListQuerySchema.parse(req.query)
  const result = await service.listarMovimientos(query)
  return reply.send(result)
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = movimientoParamsSchema.parse(req.params)
  const movimiento = await service.obtenerMovimiento(id)
  return reply.send({ data: movimiento })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = movimientoCreateSchema.parse(req.body)
  const movimiento = await service.crearMovimiento(body, req.fasUserId!)
  return reply.status(201).send({ data: movimiento })
}

// ─── Saldos ──────────────────────────────────────────────────────────────────

const saldosQuerySchema = z.object({
  bodegaId: z.coerce.number().int().positive().optional(),
  tipo: z.enum(['EMBALAJE', 'ENVASE', 'MATERIAL_EMBALAJE', 'SERVICIO']).optional(),
  bajoCritico: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
})

export async function listSaldos(req: FastifyRequest, reply: FastifyReply) {
  const query = saldosQuerySchema.parse(req.query)
  const saldos = await service.listarSaldos(query)
  return reply.send({ data: saldos })
}

const consultaStockSchema = z.object({
  embalajes: z.array(z.object({
    articuloId: z.number().int().positive(),
    cantidad: z.number().positive(),
  })).min(1, 'Debe indicar al menos un embalaje'),
  bodegaIds: z.array(z.number().int().positive()).default([]),
})

export async function consultaStockReceta(req: FastifyRequest, reply: FastifyReply) {
  const body = consultaStockSchema.parse(req.body)
  const resultado = await service.consultarStockReceta(body.embalajes, body.bodegaIds)
  return reply.send({ data: resultado })
}
