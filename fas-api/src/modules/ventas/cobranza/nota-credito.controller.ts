import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { ForbiddenError } from '../../../shared/errors.js'
import * as service from './nota-credito.service.js'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

// Autorización fina por tipo de NC (FAS-COB-NC-R1-002): la ruta admite cualquiera
// de los dos ítems, pero una NC de exportación exige FACT_EXPORTACION y una
// nacional exige FACT_NACIONAL — un perfil con solo uno no puede leer la del otro.
function autorizarLecturaNc(req: FastifyRequest, nc: { facturaExportacionId: number | null }) {
  const item = nc.facturaExportacionId != null ? 'FACT_EXPORTACION' : 'FACT_NACIONAL'
  const nivel = req.fasAccesos?.get(item) ?? 'SIN_ACCESO'
  if (nivel === 'SIN_ACCESO') {
    throw new ForbiddenError(`No tiene acceso a esta Nota de Crédito (requiere ${item}).`)
  }
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = paramsSchema.parse(req.params)
  const nc = await service.obtenerNc(id)
  autorizarLecturaNc(req, nc)
  return reply.send({ data: nc })
}

export async function descargarXml(req: FastifyRequest, reply: FastifyReply) {
  const { id } = paramsSchema.parse(req.params)
  const nc = await service.obtenerNc(id)
  autorizarLecturaNc(req, nc)
  const { xml, codigo, folio } = await service.obtenerXmlNc(id)
  const nombre = `${codigo}${folio ? `-folio-${folio}` : ''}.xml`.replace(/[^\w.-]+/g, '_')
  return reply
    .header('Content-Type', 'application/xml; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="${nombre}"`)
    .send(xml)
}

export async function descargarPdf(req: FastifyRequest, reply: FastifyReply) {
  const { id } = paramsSchema.parse(req.params)
  const nc = await service.obtenerNc(id)
  autorizarLecturaNc(req, nc)
  const { pdf, folio } = await service.obtenerPdfNc(id)
  return reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `inline; filename="nota-credito-folio-${folio}.pdf"`)
    .send(pdf)
}
