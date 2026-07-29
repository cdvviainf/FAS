import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  templateCargaCreateSchema,
  templateCargaUpdateSchema,
  templateCargaParamsSchema,
  templateCargaListQuerySchema,
} from './templates-carga.schema.js'
import * as service from './templates-carga.service.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const { q } = templateCargaListQuerySchema.parse(req.query)
  const templates = await service.listarTemplatesCarga(q)
  return reply.send({ data: templates })
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = templateCargaParamsSchema.parse(req.params)
  const template = await service.obtenerTemplateCarga(id)
  return reply.send({ data: template })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = templateCargaCreateSchema.parse(req.body)
  const template = await service.crearTemplateCarga(body, req.fasUserId!)
  return reply.status(201).send({ data: template })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = templateCargaParamsSchema.parse(req.params)
  const body = templateCargaUpdateSchema.parse(req.body)
  const template = await service.actualizarTemplateCarga(id, body, req.fasUserId!)
  return reply.send({ data: template })
}

export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const { id } = templateCargaParamsSchema.parse(req.params)
  await service.eliminarTemplateCarga(id, req.fasUserId!)
  return reply.status(204).send()
}
