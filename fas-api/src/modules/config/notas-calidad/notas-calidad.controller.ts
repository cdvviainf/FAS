import type { FastifyRequest, FastifyReply } from 'fastify'
import { notaCalidadCreateSchema, notaCalidadUpdateSchema, notaCalidadParamsSchema } from './notas-calidad.schema.js'
import * as service from './notas-calidad.service.js'

export async function list(_req: FastifyRequest, reply: FastifyReply) {
  const notas = await service.listarNotasCalidad()
  return reply.send({ data: notas })
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = notaCalidadParamsSchema.parse(req.params)
  const nota = await service.obtenerNotaCalidad(id)
  return reply.send({ data: nota })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = notaCalidadCreateSchema.parse(req.body)
  const nota = await service.crearNotaCalidad(body, req.fasUserId!)
  return reply.status(201).send({ data: nota })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = notaCalidadParamsSchema.parse(req.params)
  const body = notaCalidadUpdateSchema.parse(req.body)
  const nota = await service.actualizarNotaCalidad(id, body, req.fasUserId!)
  return reply.send({ data: nota })
}

export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const { id } = notaCalidadParamsSchema.parse(req.params)
  await service.eliminarNotaCalidad(id, req.fasUserId!)
  return reply.status(204).send()
}
