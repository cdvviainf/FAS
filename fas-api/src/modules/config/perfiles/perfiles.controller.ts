import type { FastifyRequest, FastifyReply } from 'fastify'
import * as service from './perfiles.service.js'
import {
  perfilCreateSchema,
  perfilUpdateSchema,
  perfilIdParamSchema,
  perfilListQuerySchema,
} from './perfiles.schema.js'

export async function listPerfiles(req: FastifyRequest, reply: FastifyReply) {
  const query = perfilListQuerySchema.parse(req.query)
  const result = await service.listarPerfiles(query.page, query.limit, query.q)
  return reply.send(result)
}

export async function getPerfilById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = perfilIdParamSchema.parse(req.params)
  const result = await service.obtenerPerfil(id)
  return reply.send(result)
}

export async function createPerfil(req: FastifyRequest, reply: FastifyReply) {
  const input = perfilCreateSchema.parse(req.body)
  const result = await service.crearPerfil(input, req.fasUserId)
  return reply.status(201).send(result)
}

export async function updatePerfil(req: FastifyRequest, reply: FastifyReply) {
  const { id } = perfilIdParamSchema.parse(req.params)
  const input = perfilUpdateSchema.parse(req.body)
  const result = await service.actualizarPerfil(id, input, req.fasUserId)
  return reply.send(result)
}

export async function deletePerfil(req: FastifyRequest, reply: FastifyReply) {
  const { id } = perfilIdParamSchema.parse(req.params)
  await service.eliminarPerfil(id, req.fasUserId)
  return reply.status(204).send()
}

export async function listItemsMenu(req: FastifyRequest, reply: FastifyReply) {
  const result = await service.listarItemsMenu()
  return reply.send(result)
}
