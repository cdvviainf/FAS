import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { ValidationError } from '../../../shared/errors.js'
import * as service from './especies-imagen.service.js'

const idParamSchema = z.object({ id: z.coerce.number().int().positive() })

export async function subirImagen(req: FastifyRequest, reply: FastifyReply) {
  const { id } = idParamSchema.parse(req.params)
  const archivo = await req.file()
  if (!archivo) throw new ValidationError('No se recibió ningún archivo')
  const datos = await archivo.toBuffer()
  await service.subirImagen(id, { mime: archivo.mimetype, datos }, req.fasUserId!)
  return reply.status(201).send({ data: { ok: true } })
}

export async function descargarImagen(req: FastifyRequest, reply: FastifyReply) {
  const { id } = idParamSchema.parse(req.params)
  const imagen = await service.descargarImagen(id)
  return reply
    .header('Content-Type', imagen.mime)
    .header('Content-Length', String(imagen.datos.length))
    .header('Cache-Control', 'private, max-age=300')
    .send(imagen.datos)
}

export async function eliminarImagen(req: FastifyRequest, reply: FastifyReply) {
  const { id } = idParamSchema.parse(req.params)
  await service.eliminarImagen(id)
  return reply.status(204).send()
}
