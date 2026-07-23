import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import * as repo from './productores.repository.js'
import { NotFoundError } from '../../shared/errors.js'

const listQuerySchema = z.object({
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
})

const paramsSchema = z.object({
  entidadId: z.coerce.number().int().positive(),
})

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const query = listQuerySchema.parse(req.query)
  const { data, total } = await repo.listProductores(query)
  return reply.send({
    data,
    meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
  })
}

export async function getFicha(req: FastifyRequest, reply: FastifyReply) {
  const { entidadId } = paramsSchema.parse(req.params)
  const ficha = await repo.getFicha(entidadId)
  if (!ficha) throw new NotFoundError('Productor', String(entidadId))

  // PROD-01: la ficha (PROD_FICHA) no debe filtrar datos de Contrato a perfiles
  // sin acceso al ítem PROD_CONTRATO — cada sub-recurso protege su propio permiso.
  const nivelContrato = req.fasAccesos?.get('PROD_CONTRATO') ?? 'SIN_ACCESO'
  if (nivelContrato === 'SIN_ACCESO') {
    return reply.send({ data: { ...ficha, contratos: [] } })
  }
  return reply.send({ data: ficha })
}
