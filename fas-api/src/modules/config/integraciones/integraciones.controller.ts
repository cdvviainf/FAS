import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  integracionCreateSchema,
  integracionUpdateSchema,
  integracionParamsSchema,
  integracionListQuerySchema,
  integracionParametroSchema,
  integracionParametroUpdateSchema,
  integracionParametroParamsSchema,
  maestroParamsSchema,
} from './integraciones.schema.js'
import * as service from './integraciones.service.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const { page, limit } = integracionListQuerySchema.parse(req.query)
  const result = await service.listarIntegraciones({ page, limit })
  return reply.send(result)
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = integracionParamsSchema.parse(req.params)
  const integracion = await service.obtenerIntegracion(id)
  return reply.send({ data: integracion })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = integracionCreateSchema.parse(req.body)
  const integracion = await service.crearIntegracion(body, req.fasUserId!)
  return reply.status(201).send({ data: integracion })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = integracionParamsSchema.parse(req.params)
  const body = integracionUpdateSchema.parse(req.body)
  const integracion = await service.actualizarIntegracion(id, body, req.fasUserId!)
  return reply.send({ data: integracion })
}

export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const { id } = integracionParamsSchema.parse(req.params)
  await service.eliminarIntegracion(id, req.fasUserId!)
  return reply.status(204).send()
}

export async function addParametro(req: FastifyRequest, reply: FastifyReply) {
  const { id } = integracionParamsSchema.parse(req.params)
  const body = integracionParametroSchema.parse(req.body)
  const parametro = await service.agregarParametro(id, body)
  return reply.status(201).send({ data: parametro })
}

export async function updateParametro(req: FastifyRequest, reply: FastifyReply) {
  const { id, parametroId } = integracionParametroParamsSchema.parse(req.params)
  const body = integracionParametroUpdateSchema.parse(req.body)
  const parametro = await service.actualizarParametro(id, parametroId, body)
  return reply.send({ data: parametro })
}

export async function removeParametro(req: FastifyRequest, reply: FastifyReply) {
  const { id, parametroId } = integracionParametroParamsSchema.parse(req.params)
  await service.eliminarParametro(id, parametroId)
  return reply.status(204).send()
}

export async function listOpcionesMaestro(req: FastifyRequest, reply: FastifyReply) {
  const { maestro } = maestroParamsSchema.parse(req.params)
  const opciones = await service.listarOpcionesMaestro(maestro)
  return reply.send({ data: opciones })
}
