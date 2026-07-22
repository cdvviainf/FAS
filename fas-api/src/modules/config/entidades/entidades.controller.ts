import type { FastifyRequest, FastifyReply } from 'fastify'
import * as service from './entidades.service.js'
import {
  entidadCreateSchema,
  entidadUpdateSchema,
  entidadIdParamSchema,
  entidadDireccionParamSchema,
  entidadContactoParamSchema,
  entidadListQuerySchema,
  direccionCreateSchema,
  direccionUpdateSchema,
  contactoCreateSchema,
  contactoUpdateSchema,
} from './entidades.schema.js'

// ─── Entidades ────────────────────────────────────────────────────────────────

export async function listEntidades(req: FastifyRequest, reply: FastifyReply) {
  const query = entidadListQuerySchema.parse(req.query)
  const result = await service.listarEntidades(
    query.page,
    query.limit,
    query.q,
    query.tipo,
    query.activo,
  )
  return reply.send(result)
}

export async function getEntidadById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = entidadIdParamSchema.parse(req.params)
  const result = await service.obtenerEntidad(id)
  return reply.send(result)
}

export async function createEntidad(req: FastifyRequest, reply: FastifyReply) {
  const input = entidadCreateSchema.parse(req.body)
  const result = await service.crearEntidad(input, req.fasUserId!)
  return reply.status(201).send(result)
}

export async function updateEntidad(req: FastifyRequest, reply: FastifyReply) {
  const { id } = entidadIdParamSchema.parse(req.params)
  const input = entidadUpdateSchema.parse(req.body)
  const result = await service.actualizarEntidad(id, input, req.fasUserId!)
  return reply.send(result)
}

export async function deleteEntidad(req: FastifyRequest, reply: FastifyReply) {
  const { id } = entidadIdParamSchema.parse(req.params)
  await service.eliminarEntidad(id, req.fasUserId!)
  return reply.status(204).send()
}

// ─── Direcciones ──────────────────────────────────────────────────────────────

export async function createDireccion(req: FastifyRequest, reply: FastifyReply) {
  const { id } = entidadIdParamSchema.parse(req.params)
  const input = direccionCreateSchema.parse(req.body)
  const result = await service.crearDireccion(id, input, req.fasUserId!)
  return reply.status(201).send(result)
}

export async function updateDireccion(req: FastifyRequest, reply: FastifyReply) {
  const { id, dirId } = entidadDireccionParamSchema.parse(req.params)
  const input = direccionUpdateSchema.parse(req.body)
  const result = await service.actualizarDireccion(id, dirId, input, req.fasUserId!)
  return reply.send(result)
}

export async function deleteDireccion(req: FastifyRequest, reply: FastifyReply) {
  const { id, dirId } = entidadDireccionParamSchema.parse(req.params)
  await service.eliminarDireccion(id, dirId, req.fasUserId!)
  return reply.status(204).send()
}

// ─── Contactos ────────────────────────────────────────────────────────────────

export async function createContacto(req: FastifyRequest, reply: FastifyReply) {
  const { id } = entidadIdParamSchema.parse(req.params)
  const input = contactoCreateSchema.parse(req.body)
  const result = await service.crearContacto(id, input, req.fasUserId!)
  return reply.status(201).send(result)
}

export async function updateContacto(req: FastifyRequest, reply: FastifyReply) {
  const { id, conId } = entidadContactoParamSchema.parse(req.params)
  const input = contactoUpdateSchema.parse(req.body)
  const result = await service.actualizarContacto(id, conId, input, req.fasUserId!)
  return reply.send(result)
}

export async function deleteContacto(req: FastifyRequest, reply: FastifyReply) {
  const { id, conId } = entidadContactoParamSchema.parse(req.params)
  await service.eliminarContacto(id, conId, req.fasUserId!)
  return reply.status(204).send()
}
