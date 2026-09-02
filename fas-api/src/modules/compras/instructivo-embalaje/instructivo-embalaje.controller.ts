import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  instructivoEmbalajeCreateSchema,
  instructivoEmbalajeUpdateSchema,
  instructivoEmbalajeParamsSchema,
  instructivoEmbalajeListQuerySchema,
  inspeccionAprobarSchema,
  inspeccionRechazarSchema,
  foliosCreateSchema,
  folioParamsSchema,
} from './instructivo-embalaje.schema.js'
import * as service from './instructivo-embalaje.service.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const { page, limit, entidadProductorId, estadoInspeccion, seleccionable } = instructivoEmbalajeListQuerySchema.parse(req.query)
  const result = await service.listarInstructivos(page, limit, entidadProductorId, estadoInspeccion, seleccionable)
  return reply.send(result)
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = instructivoEmbalajeParamsSchema.parse(req.params)
  const instructivo = await service.obtenerInstructivo(id)
  return reply.send({ data: instructivo })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = instructivoEmbalajeCreateSchema.parse(req.body)
  const instructivo = await service.crearInstructivo(body, req.fasUserId!)
  return reply.status(201).send({ data: instructivo })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = instructivoEmbalajeParamsSchema.parse(req.params)
  const body = instructivoEmbalajeUpdateSchema.parse(req.body)
  const instructivo = await service.actualizarInstructivo(id, body)
  return reply.send({ data: instructivo })
}

export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const { id } = instructivoEmbalajeParamsSchema.parse(req.params)
  await service.eliminarInstructivo(id, req.fasUserId!)
  return reply.status(204).send()
}

// ─── Inspección de Proceso ──────────────────────────────────────────────────

export async function notificarInspeccion(req: FastifyRequest, reply: FastifyReply) {
  const { id } = instructivoEmbalajeParamsSchema.parse(req.params)
  const instructivo = await service.notificarInspeccion(id)
  return reply.send({ data: instructivo })
}

export async function aprobarInspeccion(req: FastifyRequest, reply: FastifyReply) {
  const { id } = instructivoEmbalajeParamsSchema.parse(req.params)
  const { comentario } = inspeccionAprobarSchema.parse(req.body)
  const instructivo = await service.aprobarInspeccion(id, comentario, req.fasUserId!)
  return reply.send({ data: instructivo })
}

export async function rechazarInspeccion(req: FastifyRequest, reply: FastifyReply) {
  const { id } = instructivoEmbalajeParamsSchema.parse(req.params)
  const { comentario } = inspeccionRechazarSchema.parse(req.body)
  const instructivo = await service.rechazarInspeccion(id, comentario, req.fasUserId!)
  return reply.send({ data: instructivo })
}

export async function cerrarInspeccion(req: FastifyRequest, reply: FastifyReply) {
  const { id } = instructivoEmbalajeParamsSchema.parse(req.params)
  const instructivo = await service.cerrarInspeccion(id)
  return reply.send({ data: instructivo })
}

export async function agregarFolios(req: FastifyRequest, reply: FastifyReply) {
  const { id } = instructivoEmbalajeParamsSchema.parse(req.params)
  const { folios } = foliosCreateSchema.parse(req.body)
  const instructivo = await service.agregarFolios(id, folios, req.fasUserId!)
  return reply.status(201).send({ data: instructivo })
}

export async function quitarFolio(req: FastifyRequest, reply: FastifyReply) {
  const { id, folioId } = folioParamsSchema.parse(req.params)
  const instructivo = await service.quitarFolio(id, folioId)
  return reply.send({ data: instructivo })
}
