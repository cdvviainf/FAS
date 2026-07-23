import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  articuloCreateSchema,
  articuloUpdateSchema,
  articuloParamsSchema,
  articuloListQuerySchema,
} from './articulos.schema.js'
import * as service from './articulos.service.js'
import { ValidationError } from '../../../shared/errors.js'
import { z } from 'zod'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const query = articuloListQuerySchema.parse(req.query)
  const result = await service.listarArticulos(query)
  return reply.send(result)
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = articuloParamsSchema.parse(req.params)
  const articulo = await service.obtenerArticulo(id)
  return reply.send({ data: articulo })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = articuloCreateSchema.parse(req.body)
  const articulo = await service.crearArticulo(body)
  return reply.status(201).send({ data: articulo })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = articuloParamsSchema.parse(req.params)
  const body = articuloUpdateSchema.parse(req.body)
  const articulo = await service.actualizarArticulo(id, body)
  return reply.send({ data: articulo })
}

// ─── Documentos ──────────────────────────────────────────────────────────────

export async function listDocumentos(req: FastifyRequest, reply: FastifyReply) {
  const { id } = articuloParamsSchema.parse(req.params)
  const documentos = await service.listarDocumentos(id)
  return reply.send({ data: documentos })
}

export async function subirDocumento(req: FastifyRequest, reply: FastifyReply) {
  const { id } = articuloParamsSchema.parse(req.params)
  const archivo = await req.file()
  if (!archivo) throw new ValidationError('No se recibió ningún archivo')
  const datos = await archivo.toBuffer()
  const documento = await service.subirDocumento(
    id,
    { nombre: archivo.filename, mime: archivo.mimetype, datos },
    req.fasUserId!,
  )
  return reply.status(201).send({ data: documento })
}

const documentoParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  docId: z.coerce.number().int().positive(),
})

export async function descargarDocumento(req: FastifyRequest, reply: FastifyReply) {
  const { id, docId } = documentoParamsSchema.parse(req.params)
  const { meta, datos } = await service.descargarDocumento(id, docId)
  return reply
    .header('Content-Type', meta.mime)
    .header('Content-Disposition', `attachment; filename="${encodeURIComponent(meta.nombre)}"`)
    .header('Content-Length', String(datos.length))
    .send(datos)
}

export async function eliminarDocumento(req: FastifyRequest, reply: FastifyReply) {
  const { id, docId } = documentoParamsSchema.parse(req.params)
  await service.eliminarDocumento(id, docId)
  return reply.status(204).send()
}
