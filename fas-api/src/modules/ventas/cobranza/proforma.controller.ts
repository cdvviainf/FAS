import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  embarqueParamsSchema,
  proformaEmitirSchema,
  proformaParamsSchema,
  proformasListQuerySchema,
  sugerenciaQuerySchema,
} from './proforma.schema.js'
import * as service from './proforma.service.js'

export async function sugerirLineas(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const { dimensiones } = sugerenciaQuerySchema.parse(req.query)
  const lineas = await service.sugerirLineas(id, dimensiones)
  return reply.send({ data: lineas })
}

export async function emitirProforma(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const body = proformaEmitirSchema.parse(req.body)
  const proforma = await service.emitirProforma(id, body, req.fasUserId!)
  return reply.status(201).send({ data: proforma })
}

export async function obtenerProformaDelEmbarque(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const proforma = await service.obtenerProformaPorEmbarque(id)
  return reply.send({ data: proforma })
}

export async function listar(req: FastifyRequest, reply: FastifyReply) {
  const query = proformasListQuerySchema.parse(req.query)
  const resultado = await service.listarProformas(query)
  return reply.send(resultado)
}

export async function obtener(req: FastifyRequest, reply: FastifyReply) {
  const { id } = proformaParamsSchema.parse(req.params)
  const proforma = await service.obtenerProforma(id)
  return reply.send({ data: proforma })
}

export async function anular(req: FastifyRequest, reply: FastifyReply) {
  const { id } = proformaParamsSchema.parse(req.params)
  const proforma = await service.anularProforma(id, req.fasUserId!)
  return reply.send({ data: proforma })
}
