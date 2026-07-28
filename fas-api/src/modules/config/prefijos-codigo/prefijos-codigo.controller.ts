import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  prefijoCodigoCreateSchema,
  prefijoCodigoUpdateSchema,
  prefijoCodigoParamsSchema,
  prefijoCodigoModeloParamsSchema,
} from './prefijos-codigo.schema.js'
import * as service from './prefijos-codigo.service.js'

export async function list(_req: FastifyRequest, reply: FastifyReply) {
  const prefijos = await service.listarPrefijosCodigo()
  return reply.send({ data: prefijos })
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = prefijoCodigoParamsSchema.parse(req.params)
  const prefijo = await service.obtenerPrefijoCodigo(id)
  return reply.send({ data: prefijo })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = prefijoCodigoCreateSchema.parse(req.body)
  const prefijo = await service.crearPrefijoCodigo(body, req.fasUserId!)
  return reply.status(201).send({ data: prefijo })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = prefijoCodigoParamsSchema.parse(req.params)
  const body = prefijoCodigoUpdateSchema.parse(req.body)
  const prefijo = await service.actualizarPrefijoCodigo(id, body, req.fasUserId!)
  return reply.send({ data: prefijo })
}

export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const { id } = prefijoCodigoParamsSchema.parse(req.params)
  await service.eliminarPrefijoCodigo(id, req.fasUserId!)
  return reply.status(204).send()
}

export async function getSiguienteCodigo(req: FastifyRequest, reply: FastifyReply) {
  const { modelo } = prefijoCodigoModeloParamsSchema.parse(req.params)
  const codigo = await service.siguienteCodigo(modelo)
  return reply.send({ data: { codigo } })
}
