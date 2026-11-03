import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  proformaProductorCreateSchema,
  proformaProductorUpdateSchema,
  proformaProductorParamsSchema,
  proformaProductorListQuerySchema,
  proformaTipoCambioQuerySchema,
} from './proformas.schema.js'
import * as service from './proformas.service.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const { page, limit, entidadId, estado, q } = proformaProductorListQuerySchema.parse(req.query)
  const result = await service.listarProformasProductor({ page, limit, entidadId, estado, q })
  return reply.send(result)
}

export async function tipoCambio(req: FastifyRequest, reply: FastifyReply) {
  const { moneda, fecha } = proformaTipoCambioQuerySchema.parse(req.query)
  return reply.send({ data: await service.obtenerTipoCambioSugerido(moneda, fecha) })
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = proformaProductorParamsSchema.parse(req.params)
  const proforma = await service.obtenerProformaProductor(id)
  return reply.send({ data: proforma })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = proformaProductorCreateSchema.parse(req.body)
  const proforma = await service.crearProformaProductor(body, req.fasUserId!)
  return reply.status(201).send({ data: proforma })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = proformaProductorParamsSchema.parse(req.params)
  const body = proformaProductorUpdateSchema.parse(req.body)
  const proforma = await service.actualizarProformaProductor(id, body, req.fasUserId!)
  return reply.send({ data: proforma })
}

export async function enviarValidacion(req: FastifyRequest, reply: FastifyReply) {
  const { id } = proformaProductorParamsSchema.parse(req.params)
  const proforma = await service.enviarValidacionProformaProductor(id)
  return reply.send({ data: proforma })
}

export async function rechazar(req: FastifyRequest, reply: FastifyReply) {
  const { id } = proformaProductorParamsSchema.parse(req.params)
  const proforma = await service.rechazarProformaProductor(id)
  return reply.send({ data: proforma })
}

export async function anular(req: FastifyRequest, reply: FastifyReply) {
  const { id } = proformaProductorParamsSchema.parse(req.params)
  const proforma = await service.anularProformaProductor(id)
  return reply.send({ data: proforma })
}
