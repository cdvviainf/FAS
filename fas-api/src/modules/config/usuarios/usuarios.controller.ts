import type { FastifyRequest, FastifyReply } from 'fastify'
import * as service from './usuarios.service.js'
import {
  usuarioCreateSchema,
  usuarioUpdateSchema,
  cambiarPasswordSchema,
  usuarioIdParamSchema,
  usuarioListQuerySchema,
} from './usuarios.schema.js'

export async function listUsuarios(req: FastifyRequest, reply: FastifyReply) {
  const query = usuarioListQuerySchema.parse(req.query)
  const result = await service.listarUsuarios(query.page, query.limit, query.q, query.perfilId)
  return reply.send(result)
}

export async function getUsuarioById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = usuarioIdParamSchema.parse(req.params)
  const result = await service.obtenerUsuario(id)
  return reply.send(result)
}

export async function createUsuario(req: FastifyRequest, reply: FastifyReply) {
  const input = usuarioCreateSchema.parse(req.body)
  const result = await service.crearUsuario(input, req.fasUserId)
  return reply.status(201).send(result)
}

export async function updateUsuario(req: FastifyRequest, reply: FastifyReply) {
  const { id } = usuarioIdParamSchema.parse(req.params)
  const input = usuarioUpdateSchema.parse(req.body)
  const result = await service.actualizarUsuario(id, input, req.fasUserId)
  return reply.send(result)
}

export async function changePassword(req: FastifyRequest, reply: FastifyReply) {
  const { id } = usuarioIdParamSchema.parse(req.params)
  const input = cambiarPasswordSchema.parse(req.body)
  await service.cambiarPassword(id, input)
  return reply.status(204).send()
}

export async function deleteUsuario(req: FastifyRequest, reply: FastifyReply) {
  const { id } = usuarioIdParamSchema.parse(req.params)
  await service.eliminarUsuario(id, req.fasUserId)
  return reply.status(204).send()
}
