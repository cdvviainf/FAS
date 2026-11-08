import type { FastifyRequest, FastifyReply } from 'fastify'
import { monitorDteListQuerySchema, monitorDteParamsSchema } from './monitor-dte.schema.js'
import * as service from './monitor-dte.service.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const query = monitorDteListQuerySchema.parse(req.query)
  return reply.send(await service.listar(query))
}

export async function consultarEstadoSii(req: FastifyRequest, reply: FastifyReply) {
  const { id } = monitorDteParamsSchema.parse(req.params)
  return reply.send({ data: await service.consultarEstadoSii(id) })
}

export async function descargarXml(req: FastifyRequest, reply: FastifyReply) {
  const { id } = monitorDteParamsSchema.parse(req.params)
  const { xml, nombre } = await service.obtenerXml(id)
  return reply
    .header('Content-Type', 'application/xml')
    .header('Content-Disposition', `attachment; filename="${nombre}"`)
    .send(xml)
}

export async function descargarPdf(req: FastifyRequest, reply: FastifyReply) {
  const { id } = monitorDteParamsSchema.parse(req.params)
  const { pdf, nombre } = await service.obtenerPdf(id)
  return reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `inline; filename="${nombre}"`)
    .send(pdf)
}
