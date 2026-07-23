import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  solicitudCreateSchema,
  solicitudUpdateSchema,
  solicitudParamsSchema,
  solicitudListQuerySchema,
  solicitudCerrarSchema,
  adjuntoParamsSchema,
} from './solicitudes.schema.js'
import * as service from './solicitudes.service.js'
import { ValidationError } from '../../../shared/errors.js'
import type { EtapaAdjunto } from './solicitudes.types.js'
import { z } from 'zod'

const ITEM = 'CAL_SOLICITUDES'

function tieneNivelTotal(req: FastifyRequest): boolean {
  return (req.fasAccesos?.get(ITEM) ?? 'SIN_ACCESO') === 'TOTAL'
}

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const query = solicitudListQuerySchema.parse(req.query)
  const result = await service.listarSolicitudes(query)
  return reply.send(result)
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = solicitudParamsSchema.parse(req.params)
  const solicitud = await service.obtenerSolicitud(id)
  return reply.send({ data: solicitud })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = solicitudCreateSchema.parse(req.body)
  const solicitud = await service.crearSolicitud(body, req.fasUserId!)
  return reply.status(201).send({ data: solicitud })
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = solicitudParamsSchema.parse(req.params)
  const body = solicitudUpdateSchema.parse(req.body)
  const solicitud = await service.actualizarSolicitud(id, body, req.fasUserId!)
  return reply.send({ data: solicitud })
}

export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const { id } = solicitudParamsSchema.parse(req.params)
  await service.eliminarSolicitud(id, req.fasUserId!)
  return reply.status(204).send()
}

export async function notificar(req: FastifyRequest, reply: FastifyReply) {
  const { id } = solicitudParamsSchema.parse(req.params)
  const solicitud = await service.notificarSolicitud(id, req.fasUserId!)
  return reply.send({ data: solicitud })
}

export async function cerrar(req: FastifyRequest, reply: FastifyReply) {
  const { id } = solicitudParamsSchema.parse(req.params)
  const body = solicitudCerrarSchema.parse(req.body)
  const solicitud = await service.cerrarSolicitud(id, body, req.fasUserId!, tieneNivelTotal(req))
  return reply.send({ data: solicitud })
}

export async function reabrir(req: FastifyRequest, reply: FastifyReply) {
  const { id } = solicitudParamsSchema.parse(req.params)
  const solicitud = await service.reabrirSolicitud(id, req.fasUserId!)
  return reply.send({ data: solicitud })
}

// ─── Adjuntos ────────────────────────────────────────────────────────────────

const etapaQuerySchema = z.object({
  etapa: z.enum(['CREACION', 'CIERRE']).default('CREACION'),
})

export async function subirAdjunto(req: FastifyRequest, reply: FastifyReply) {
  const { id } = solicitudParamsSchema.parse(req.params)
  const { etapa } = etapaQuerySchema.parse(req.query)

  const archivo = await req.file()
  if (!archivo) throw new ValidationError('No se recibió ningún archivo')

  const datos = await archivo.toBuffer()
  const adjunto = await service.subirAdjunto(
    id,
    { nombre: archivo.filename, mime: archivo.mimetype, datos },
    etapa as EtapaAdjunto,
    req.fasUserId!,
    tieneNivelTotal(req),
  )
  return reply.status(201).send({ data: adjunto })
}

export async function descargarAdjunto(req: FastifyRequest, reply: FastifyReply) {
  const { id, adjuntoId } = adjuntoParamsSchema.parse(req.params)
  const { meta, datos } = await service.descargarAdjunto(id, adjuntoId)
  return reply
    .header('Content-Type', meta.mime)
    .header('Content-Disposition', `attachment; filename="${encodeURIComponent(meta.nombre)}"`)
    .header('Content-Length', String(datos.length))
    .send(datos)
}

export async function eliminarAdjunto(req: FastifyRequest, reply: FastifyReply) {
  const { id, adjuntoId } = adjuntoParamsSchema.parse(req.params)
  await service.eliminarAdjunto(id, adjuntoId, req.fasUserId!, tieneNivelTotal(req))
  return reply.status(204).send()
}
