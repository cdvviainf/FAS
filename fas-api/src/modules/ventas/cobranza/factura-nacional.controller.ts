import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  facturaNacionalParamsSchema,
  crearBorradorSchema,
  actualizarBorradorSchema,
  facturasNacionalListQuerySchema,
  proformasFacturablesQuerySchema,
  operacionesNacionalQuerySchema,
  embarqueParamsSchema,
  tipoCambioQuerySchema,
} from './factura-nacional.schema.js'
import * as service from './factura-nacional.service.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const filters = facturasNacionalListQuerySchema.parse(req.query)
  return reply.send(await service.listarFacturas(filters))
}

export async function listOperaciones(req: FastifyRequest, reply: FastifyReply) {
  const filters = operacionesNacionalQuerySchema.parse(req.query)
  return reply.send(await service.listarOperaciones(filters))
}

export async function listProformasFacturables(req: FastifyRequest, reply: FastifyReply) {
  const filters = proformasFacturablesQuerySchema.parse(req.query)
  return reply.send(await service.listarProformasFacturables(filters))
}

export async function listEmbarquesFacturables(req: FastifyRequest, reply: FastifyReply) {
  const filters = proformasFacturablesQuerySchema.parse(req.query)
  return reply.send(await service.listarEmbarquesFacturables(filters))
}

export async function crear(req: FastifyRequest, reply: FastifyReply) {
  const { proformaMaterialId } = crearBorradorSchema.parse(req.body)
  const factura = await service.crearBorradorDesdeProforma(proformaMaterialId, req.fasUserId!)
  return reply.status(201).send({ data: factura })
}

export async function crearDesdeEmbarque(req: FastifyRequest, reply: FastifyReply) {
  const { embarqueId } = embarqueParamsSchema.parse(req.params)
  const factura = await service.crearBorradorDesdeEmbarque(embarqueId, req.fasUserId!)
  return reply.status(201).send({ data: factura })
}

export async function tipoCambio(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaNacionalParamsSchema.parse(req.params)
  const { fecha } = tipoCambioQuerySchema.parse(req.query)
  return reply.send({ data: await service.obtenerTipoCambioSugerido(id, fecha) })
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaNacionalParamsSchema.parse(req.params)
  return reply.send({ data: await service.obtenerFactura(id) })
}

export async function actualizar(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaNacionalParamsSchema.parse(req.params)
  const body = actualizarBorradorSchema.parse(req.body)
  return reply.send({ data: await service.actualizarBorrador(id, body) })
}

export async function enviarSii(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaNacionalParamsSchema.parse(req.params)
  return reply.send({ data: await service.enviarBorradorSii(id, req.fasUserId!) })
}

export async function firmar(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaNacionalParamsSchema.parse(req.params)
  return reply.send({ data: await service.firmar(id, req.fasUserId!) })
}

export async function reabrir(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaNacionalParamsSchema.parse(req.params)
  return reply.send({ data: await service.reabrirFactura(id) })
}

export async function consultarSii(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaNacionalParamsSchema.parse(req.params)
  return reply.send({ data: await service.consultarEstadoSii(id) })
}

export async function anular(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaNacionalParamsSchema.parse(req.params)
  return reply.send({ data: await service.anularFactura(id, req.fasUserId!) })
}

export async function anularConNc(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaNacionalParamsSchema.parse(req.params)
  return reply.send({ data: await service.anularConNotaCredito(id, req.fasUserId!) })
}

export async function descargarPdfBorrador(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaNacionalParamsSchema.parse(req.params)
  const { pdf, codigo } = await service.obtenerPdfBorrador(id)
  const nombre = `${codigo}.pdf`.replace(/[^\w.-]+/g, '_')
  return reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `attachment; filename="${nombre}"`)
    .send(pdf)
}

export async function descargarXml(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaNacionalParamsSchema.parse(req.params)
  const { xml, codigo } = await service.obtenerXmlFactura(id)
  const nombre = `${codigo}.xml`.replace(/[^\w.-]+/g, '_')
  return reply
    .header('Content-Type', 'application/xml')
    .header('Content-Disposition', `attachment; filename="${nombre}"`)
    .send(xml)
}
