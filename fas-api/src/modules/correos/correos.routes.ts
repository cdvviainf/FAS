import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireAuth, requireLevel } from '../../plugins/auth-guard.js'
import { ConflictError, NotFoundError } from '../../shared/errors.js'
import * as repo from './correos.repository.js'
import { reencolarRegistro } from './correos.queue.js'

// Visor de correos enviados (2026-11-11) — Configuración › Herramientas.
const ITEM = 'CONFIG_CORREOS_ENVIADOS'

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  estado: z.enum(['PENDIENTE', 'ENVIADO', 'FALLIDO']).optional(),
  q: z.string().trim().min(1).optional(),
  // CE-QA-002: límites ISO exactos calculados por el cliente en su hora local
  // (inicio del día "desde" y inicio del día siguiente a "hasta", exclusivo).
  desde: z.string().datetime({ offset: true }).optional(),
  hasta: z.string().datetime({ offset: true }).optional(),
})
const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

async function list(req: FastifyRequest, reply: FastifyReply) {
  const q = listQuerySchema.parse(req.query)
  const { data, total } = await repo.list({ ...q, desde: q.desde ? new Date(q.desde) : undefined, hasta: q.hasta ? new Date(q.hasta) : undefined })
  return reply.send({ data, meta: { total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) } })
}

async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = paramsSchema.parse(req.params)
  const r = await repo.getById(id)
  if (!r) throw new NotFoundError('Correo', String(id))
  return reply.send({ data: r })
}

// Reintento por registro (destinatario): mismo contenido; el PDF se regenera.
async function reintentar(req: FastifyRequest, reply: FastifyReply) {
  const { id } = paramsSchema.parse(req.params)
  const r = await repo.getById(id)
  if (!r) throw new NotFoundError('Correo', String(id))
  if (!(await repo.marcarReintento(id, req.fasUserId!))) {
    throw new ConflictError('Este correo ya está pendiente de envío')
  }
  await reencolarRegistro(r)
  return reply.send({ data: await repo.getById(id) })
}

export async function correosEnviadosRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, list)
  app.get('/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, getById)
  app.post('/:id/reintentar', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, reintentar)
}
