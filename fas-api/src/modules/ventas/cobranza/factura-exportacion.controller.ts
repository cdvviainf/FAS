import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  embarqueParamsSchema,
  facturaExportacionActualizarSchema,
  facturaParamsSchema,
  facturasExportacionListQuerySchema,
  proformaParamsSchema,
} from './factura-exportacion.schema.js'
import * as service from './factura-exportacion.service.js'

export async function crearDesdeProforma(req: FastifyRequest, reply: FastifyReply) {
  const { id } = proformaParamsSchema.parse(req.params)
  const factura = await service.crearBorradorDesdeProforma(id, req.fasUserId!)
  return reply.status(201).send({ data: factura })
}

export async function actualizar(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaParamsSchema.parse(req.params)
  const body = facturaExportacionActualizarSchema.parse(req.body)
  const factura = await service.actualizarBorrador(id, body, req.fasUserId!)
  return reply.send({ data: factura })
}

export async function emitir(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaParamsSchema.parse(req.params)
  const factura = await service.emitir(id, req.fasUserId!)
  return reply.send({ data: factura })
}

export async function obtenerDelEmbarque(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const factura = await service.obtenerPorEmbarque(id)
  return reply.send({ data: factura })
}

export async function listar(req: FastifyRequest, reply: FastifyReply) {
  const query = facturasExportacionListQuerySchema.parse(req.query)
  const resultado = await service.listarFacturas(query)
  return reply.send(resultado)
}

export async function obtener(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaParamsSchema.parse(req.params)
  const factura = await service.obtenerFactura(id)
  return reply.send({ data: factura })
}

export async function anular(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaParamsSchema.parse(req.params)
  const factura = await service.anularFactura(id, req.fasUserId!)
  return reply.send({ data: factura })
}
