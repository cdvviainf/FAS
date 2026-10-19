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

// Opciones (usuarios/entidades) para los filtros del frontend, protegidas por
// CONFIG_AUDITORIA — así el filtro de usuario no depende de CONFIG_USUARIOS.
export async function facetas(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send(await service.facetas())
}

// Export CSV respetando los mismos filtros (sin paginación, tope en el service).
export async function exportCsv(req: FastifyRequest, reply: FastifyReply) {
  const filters = auditoriaListQuerySchema.parse(req.query)
  const { csv, total, truncado } = await service.exportarCsv(filters)
  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', 'attachment; filename="auditoria.csv"')
    .header('X-Total-Registros', String(total))
    .header('X-Truncado', String(truncado))
    .send(csv)
}
