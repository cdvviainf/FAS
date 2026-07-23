import type { FastifyRequest, FastifyReply } from 'fastify'
import { correoConfigBodySchema, correoProbarBodySchema } from './correo.schema.js'
import * as service from './correo.service.js'

export async function getConfiguracion(_req: FastifyRequest, reply: FastifyReply) {
  const config = await service.obtenerConfiguracion()
  return reply.send({ data: config })
}

export async function putConfiguracion(req: FastifyRequest, reply: FastifyReply) {
  const body = correoConfigBodySchema.parse(req.body)
  const saved = await service.guardarConfiguracion(body, req.fasUserId!)
  return reply.send({ data: saved })
}

export async function postProbar(req: FastifyRequest, reply: FastifyReply) {
  const body = correoProbarBodySchema.parse(req.body)
  await service.enviarCorreoPrueba(body.destinatario)
  return reply.send({ data: { enviado: true } })
}
