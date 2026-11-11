import type { FastifyReply, FastifyRequest } from 'fastify'
import * as service from './solicitudes-pago.service.js'
import {
  confirmarPagoSchema,
  despachadoQuerySchema,
  pendientesQuerySchema,
  solicitudCreateSchema,
  solicitudesListQuerySchema,
  solicitudParamsSchema,
  solicitudUpdateSchema,
} from './solicitudes-pago.schema.js'
import { ITEM_SOLICITUD_PAGO_CONFIRMAR } from './solicitudes-pago.types.js'

export async function despachado(req: FastifyRequest, reply: FastifyReply) {
  const q = despachadoQuerySchema.parse(req.query)
  return reply.send({ data: await service.calcularDespachado(q) })
}

export async function pendientes(req: FastifyRequest, reply: FastifyReply) {
  const q = pendientesQuerySchema.parse(req.query)
  return reply.send({ data: await service.listarPendientes(q) })
}

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const q = solicitudesListQuerySchema.parse(req.query)
  return reply.send(await service.listarSolicitudes(q))
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = solicitudParamsSchema.parse(req.params)
  return reply.send({ data: await service.obtenerSolicitud(id) })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = solicitudCreateSchema.parse(req.body)
  return reply.status(201).send({ data: await service.crearSolicitud(body, req.fasUserId!) })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = solicitudParamsSchema.parse(req.params)
  const body = solicitudUpdateSchema.parse(req.body)
  return reply.send({ data: await service.actualizarSolicitud(id, body, req.fasUserId!) })
}

export async function confirmarPago(req: FastifyRequest, reply: FastifyReply) {
  const { id } = solicitudParamsSchema.parse(req.params)
  const body = confirmarPagoSchema.parse(req.body)
  return reply.send({ data: await service.confirmarPago(id, body, req.fasUserId!) })
}

export async function anular(req: FastifyRequest, reply: FastifyReply) {
  const { id } = solicitudParamsSchema.parse(req.params)
  const puedeConfirmar = (req.fasAccesos?.get(ITEM_SOLICITUD_PAGO_CONFIRMAR) ?? 'SIN_ACCESO') === 'TOTAL'
  return reply.send({ data: await service.anularSolicitud(id, req.fasUserId!, puedeConfirmar) })
}
