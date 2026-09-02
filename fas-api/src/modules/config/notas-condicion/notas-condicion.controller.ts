import type { FastifyRequest, FastifyReply } from 'fastify'
import { notaCondicionCreateSchema, notaCondicionUpdateSchema, notaCondicionParamsSchema } from './notas-condicion.schema.js'
import * as service from './notas-condicion.service.js'

export async function list(_req: FastifyRequest, reply: FastifyReply) {
  const notas = await service.listarNotasCondicion()
  return reply.send({ data: notas })
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = notaCondicionParamsSchema.parse(req.params)
  const nota = await service.obtenerNotaCondicion(id)
  return reply.send({ data: nota })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = notaCondicionCreateSchema.parse(req.body)
  const nota = await service.crearNotaCondicion(body, req.fasUserId!)
  return reply.status(201).send({ data: nota })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = notaCondicionParamsSchema.parse(req.params)
  const body = notaCondicionUpdateSchema.parse(req.body)
  const nota = await service.actualizarNotaCondicion(id, body, req.fasUserId!)
  return reply.send({ data: nota })
}

export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const { id } = notaCondicionParamsSchema.parse(req.params)
  await service.eliminarNotaCondicion(id, req.fasUserId!)
  return reply.status(204).send()
}
