import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  contratoCreateSchema,
  contratoUpdateSchema,
  contratoParamsSchema,
  productorParamsSchema,
} from './contratos.schema.js'
import * as service from './contratos.service.js'
import { ValidationError } from '../../../shared/errors.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const { entidadId } = productorParamsSchema.parse(req.params)
  const contratos = await service.listarContratos(entidadId)
  return reply.send({ data: contratos })
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { entidadId, contratoId } = contratoParamsSchema.parse(req.params)
  const contrato = await service.obtenerContrato(entidadId, contratoId)
  return reply.send({ data: contrato })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const { entidadId } = productorParamsSchema.parse(req.params)
  const body = contratoCreateSchema.parse(req.body)
  const contrato = await service.crearContrato(entidadId, body, req.fasUserId!)
  return reply.status(201).send({ data: contrato })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { entidadId, contratoId } = contratoParamsSchema.parse(req.params)
  const body = contratoUpdateSchema.parse(req.body)
  const contrato = await service.actualizarContrato(entidadId, contratoId, body, req.fasUserId!)
  return reply.send({ data: contrato })
}

export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const { entidadId, contratoId } = contratoParamsSchema.parse(req.params)
  await service.eliminarContrato(entidadId, contratoId, req.fasUserId!)
  return reply.status(204).send()
}

export async function subirPdf(req: FastifyRequest, reply: FastifyReply) {
  const { entidadId, contratoId } = contratoParamsSchema.parse(req.params)
  const archivo = await req.file()
  if (!archivo) throw new ValidationError('No se recibió ningún archivo')
  const datos = await archivo.toBuffer()
  const contrato = await service.subirPdf(entidadId, contratoId, {
    nombre: archivo.filename,
    mime: archivo.mimetype,
    datos,
  })
  return reply.status(201).send({ data: contrato })
}

export async function descargarPdf(req: FastifyRequest, reply: FastifyReply) {
  const { entidadId, contratoId } = contratoParamsSchema.parse(req.params)
  const { meta, datos } = await service.descargarPdf(entidadId, contratoId)
  return reply
    .header('Content-Type', meta.mime)
    .header('Content-Disposition', `attachment; filename="${encodeURIComponent(meta.nombre)}"`)
    .header('Content-Length', String(datos.length))
    .send(datos)
}
