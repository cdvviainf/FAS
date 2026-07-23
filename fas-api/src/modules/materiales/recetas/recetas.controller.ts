import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  recetaCreateSchema,
  recetaUpdateSchema,
  recetaParamsSchema,
  articuloParamsSchema,
} from './recetas.schema.js'
import * as service from './recetas.service.js'

export async function listPorEmbalaje(req: FastifyRequest, reply: FastifyReply) {
  const { id } = articuloParamsSchema.parse(req.params)
  const recetas = await service.listarRecetasPorEmbalaje(id)
  return reply.send({ data: recetas })
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = recetaParamsSchema.parse(req.params)
  const receta = await service.obtenerReceta(id)
  return reply.send({ data: receta })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = recetaCreateSchema.parse(req.body)
  const receta = await service.crearReceta(body)
  return reply.status(201).send({ data: receta })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = recetaParamsSchema.parse(req.params)
  const body = recetaUpdateSchema.parse(req.body)
  const receta = await service.actualizarReceta(id, body)
  return reply.send({ data: receta })
}
