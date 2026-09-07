import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  proformaMaterialCreateSchema,
  proformaMaterialUpdateSchema,
  proformaMaterialParamsSchema,
  proformaMaterialListQuerySchema,
  proformaMaterialLineaUpdateSchema,
  proformaMaterialLineaParamsSchema,
} from './proformas-venta.schema.js'
import * as service from './proformas-venta.service.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const { page, limit, entidadId, estado } = proformaMaterialListQuerySchema.parse(req.query)
  const result = await service.listarProformasMaterial({ page, limit, entidadId, estado })
  return reply.send(result)
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = proformaMaterialParamsSchema.parse(req.params)
  const proforma = await service.obtenerProformaMaterial(id)
  return reply.send({ data: proforma })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = proformaMaterialCreateSchema.parse(req.body)
  const proforma = await service.crearProformaMaterial(body, req.fasUserId!)
  return reply.status(201).send({ data: proforma })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = proformaMaterialParamsSchema.parse(req.params)
  const body = proformaMaterialUpdateSchema.parse(req.body)
  const proforma = await service.actualizarProformaMaterial(id, body, req.fasUserId!)
  return reply.send({ data: proforma })
}

export async function updateLinea(req: FastifyRequest, reply: FastifyReply) {
  const { id, lineaId } = proformaMaterialLineaParamsSchema.parse(req.params)
  const body = proformaMaterialLineaUpdateSchema.parse(req.body)
  const linea = await service.actualizarPrecioLinea(id, lineaId, body)
  return reply.send({ data: linea })
}

export async function enviarValidacion(req: FastifyRequest, reply: FastifyReply) {
  const { id } = proformaMaterialParamsSchema.parse(req.params)
  const proforma = await service.enviarValidacionProformaMaterial(id)
  return reply.send({ data: proforma })
}

export async function anular(req: FastifyRequest, reply: FastifyReply) {
  const { id } = proformaMaterialParamsSchema.parse(req.params)
  const proforma = await service.anularProformaMaterial(id)
  return reply.send({ data: proforma })
}
