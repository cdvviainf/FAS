import type { FastifyRequest, FastifyReply } from 'fastify'
import { ValidationError } from '../../../shared/errors.js'
import {
  recepcionCreateSchema,
  recepcionUpdateSchema,
  recepcionParamsSchema,
  recepcionAdjuntoParamsSchema,
  recepcionListQuerySchema,
} from './recepciones.schema.js'
import * as service from './recepciones.service.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const { page, limit, plantaId, origen, estado } = recepcionListQuerySchema.parse(req.query)
  const result = await service.listarRecepciones(page, limit, plantaId, origen, estado)
  return reply.send(result)
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = recepcionParamsSchema.parse(req.params)
  const recepcion = await service.obtenerRecepcionParaRespuesta(id)
  return reply.send({ data: recepcion })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = recepcionCreateSchema.parse(req.body)
  const recepcion = await service.crearRecepcion(body, req.fasUserId!)
  return reply.status(201).send({ data: recepcion })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = recepcionParamsSchema.parse(req.params)
  const body = recepcionUpdateSchema.parse(req.body)
  const recepcion = await service.actualizarRecepcion(id, body, req.fasUserId!)
  return reply.send({ data: recepcion })
}

export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const { id } = recepcionParamsSchema.parse(req.params)
  await service.eliminarRecepcion(id, req.fasUserId!)
  return reply.status(204).send()
}

// ─── Adjuntos ──────────────────────────────────────────────────────────────

export async function subirAdjunto(req: FastifyRequest, reply: FastifyReply) {
  const { id } = recepcionParamsSchema.parse(req.params)

  const archivo = await req.file()
  if (!archivo) throw new ValidationError('No se recibió ningún archivo')

  const datos = await archivo.toBuffer()
  const resultado = await service.subirAdjunto(
    id,
    { nombre: archivo.filename, mime: archivo.mimetype, datos },
    req.fasUserId!,
  )
  return reply.status(201).send({ data: resultado })
}

export async function descargarAdjunto(req: FastifyRequest, reply: FastifyReply) {
  const { id, adjuntoId } = recepcionAdjuntoParamsSchema.parse(req.params)
  const { meta, datos } = await service.descargarAdjunto(id, adjuntoId)
  return reply
    .header('Content-Type', meta.mime)
    .header('Content-Disposition', `attachment; filename="${encodeURIComponent(meta.nombre)}"`)
    .header('Content-Length', String(datos.length))
    .send(datos)
}

export async function eliminarAdjunto(req: FastifyRequest, reply: FastifyReply) {
  const { id, adjuntoId } = recepcionAdjuntoParamsSchema.parse(req.params)
  await service.eliminarAdjunto(id, adjuntoId)
  return reply.status(204).send()
}
