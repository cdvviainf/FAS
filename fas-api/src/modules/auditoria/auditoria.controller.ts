import type { FastifyRequest, FastifyReply } from 'fastify'
import { registrarNavegacionSchema, auditoriaListQuerySchema } from './auditoria.schema.js'
import * as service from './auditoria.service.js'

// Registra el acceso a una pantalla del frontend. Disponible para cualquier
// usuario autenticado (no requiere permiso de auditoría).
export async function registrarNavegacion(req: FastifyRequest, reply: FastifyReply) {
  const body = registrarNavegacionSchema.parse(req.body)
  await service.registrarNavegacion(body)
  return reply.status(202).send({ ok: true })
}

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const filters = auditoriaListQuerySchema.parse(req.query)
  return reply.send(await service.listar(filters))
}
