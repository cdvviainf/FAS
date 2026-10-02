import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  embarqueParamsSchema,
  embarquesDespachadosQuerySchema,
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

export async function enviarSii(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaParamsSchema.parse(req.params)
  const factura = await service.enviarBorradorSii(id, req.fasUserId!)
  return reply.send({ data: factura })
}

export async function firmar(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaParamsSchema.parse(req.params)
  const factura = await service.firmar(id, req.fasUserId!)
  return reply.send({ data: factura })
}

export async function reabrir(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaParamsSchema.parse(req.params)
  const factura = await service.reabrirFactura(id)
  return reply.send({ data: factura })
}

export async function descargarXml(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaParamsSchema.parse(req.params)
  const { xml, codigo, folio } = await service.obtenerXmlFactura(id)
  const nombre = `${codigo}${folio ? `-folio-${folio}` : ''}.xml`
  return reply
    .header('Content-Type', 'application/xml; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="${nombre}"`)
    .send(xml)
}

export async function previsualizarPayloadDte(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaParamsSchema.parse(req.params)
  const data = await service.obtenerPayloadDtePreview(id)
  return reply.send({ data })
}

export async function obtenerTipoCambio(req: FastifyRequest, reply: FastifyReply) {
  const { id } = facturaParamsSchema.parse(req.params)
  const data = await service.obtenerTipoCambioSugerido(id)
  return reply.send({ data })
}

export async function listarEmbarques(req: FastifyRequest, reply: FastifyReply) {
  const query = embarquesDespachadosQuerySchema.parse(req.query)
  const resultado = await service.listarEmbarquesDespachados(query)
  return reply.send(resultado)
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
