import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  ordenCompraMaterialCreateSchema,
  ordenCompraMaterialUpdateSchema,
  ordenCompraMaterialParamsSchema,
  ordenCompraMaterialListQuerySchema,
  ordenCompraMaterialLineaCreateSchema,
  ordenCompraMaterialLineaUpdateSchema,
  ordenCompraMaterialLineaParamsSchema,
} from './ordenes-compra.schema.js'
import * as service from './ordenes-compra.service.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const { page, limit, entidadProveedorId, estado } = ordenCompraMaterialListQuerySchema.parse(req.query)
  const result = await service.listarOrdenesCompraMaterial(page, limit, entidadProveedorId, estado)
  return reply.send(result)
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = ordenCompraMaterialParamsSchema.parse(req.params)
  const orden = await service.obtenerOrdenCompraMaterial(id)
  return reply.send({ data: orden })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = ordenCompraMaterialCreateSchema.parse(req.body)
  const orden = await service.crearOrdenCompraMaterial(body, req.fasUserId!)
  return reply.status(201).send({ data: orden })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = ordenCompraMaterialParamsSchema.parse(req.params)
  const body = ordenCompraMaterialUpdateSchema.parse(req.body)
  const orden = await service.actualizarOrdenCompraMaterial(id, body, req.fasUserId!)
  return reply.send({ data: orden })
}

export async function emitir(req: FastifyRequest, reply: FastifyReply) {
  const { id } = ordenCompraMaterialParamsSchema.parse(req.params)
  const orden = await service.emitirOrdenCompraMaterial(id)
  return reply.send({ data: orden })
}

export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const { id } = ordenCompraMaterialParamsSchema.parse(req.params)
  await service.eliminarOrdenCompraMaterial(id, req.fasUserId!)
  return reply.status(204).send()
}

export async function addLinea(req: FastifyRequest, reply: FastifyReply) {
  const { id } = ordenCompraMaterialParamsSchema.parse(req.params)
  const body = ordenCompraMaterialLineaCreateSchema.parse(req.body)
  const linea = await service.agregarLinea(id, body)
  return reply.status(201).send({ data: linea })
}

export async function updateLinea(req: FastifyRequest, reply: FastifyReply) {
  const { id, lineaId } = ordenCompraMaterialLineaParamsSchema.parse(req.params)
  const body = ordenCompraMaterialLineaUpdateSchema.parse(req.body)
  const linea = await service.actualizarLinea(id, lineaId, body)
  return reply.send({ data: linea })
}

export async function removeLinea(req: FastifyRequest, reply: FastifyReply) {
  const { id, lineaId } = ordenCompraMaterialLineaParamsSchema.parse(req.params)
  await service.eliminarLinea(id, lineaId)
  return reply.status(204).send()
}
