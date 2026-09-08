import type { FastifyReply, FastifyRequest } from 'fastify'
import { empresaContext } from '../../../lib/empresa-context.js'
import { ValidationError } from '../../../shared/errors.js'
import {
  analisisCalidadSchema,
  cerrarSchema,
  embarqueReclamosParamsSchema,
  provisionCreateSchema,
  provisionParamsSchema,
  reclamoCreateSchema,
  reclamoDocumentoParamsSchema,
  reclamoParamsSchema,
  reclamosListQuerySchema,
  valorizarSchema,
} from './reclamos.schema.js'
import * as service from './reclamos.service.js'

// ─── Creación/listado por Embarque (Ventas — embarques.routes.ts) ──────────

export async function listarLineasReclamables(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueReclamosParamsSchema.parse(req.params)
  const lineas = await service.obtenerLineasReclamables(id)
  return reply.send({ data: lineas })
}

export async function crearReclamo(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueReclamosParamsSchema.parse(req.params)
  const body = reclamoCreateSchema.parse(req.body)
  const reclamo = await service.crearReclamo(id, body, req.fasUserId!)
  return reply.status(201).send({ data: reclamo })
}

export async function listarReclamosEmbarque(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueReclamosParamsSchema.parse(req.params)
  const reclamos = await service.listarReclamosPorEmbarque(id)
  return reply.send({ data: reclamos })
}

// ─── Análisis y ciclo de vida (Calidad — reclamos.routes.ts) ───────────────

export async function listar(req: FastifyRequest, reply: FastifyReply) {
  const query = reclamosListQuerySchema.parse(req.query)
  const resultado = await service.listarReclamos(query)
  return reply.send(resultado)
}

export async function obtener(req: FastifyRequest, reply: FastifyReply) {
  const { id } = reclamoParamsSchema.parse(req.params)
  const reclamo = await service.obtenerReclamo(id)
  return reply.send({ data: reclamo })
}

export async function actualizarAnalisis(req: FastifyRequest, reply: FastifyReply) {
  const { id } = reclamoParamsSchema.parse(req.params)
  const body = analisisCalidadSchema.parse(req.body)
  const reclamo = await service.actualizarAnalisisCalidad(id, body, req.fasUserId!)
  return reply.send({ data: reclamo })
}

export async function valorizar(req: FastifyRequest, reply: FastifyReply) {
  const { id } = reclamoParamsSchema.parse(req.params)
  const body = valorizarSchema.parse(req.body)
  const reclamo = await service.valorizarReclamo(id, body, req.fasUserId!)
  return reply.send({ data: reclamo })
}

export async function cerrar(req: FastifyRequest, reply: FastifyReply) {
  const { id } = reclamoParamsSchema.parse(req.params)
  const body = cerrarSchema.parse(req.body)
  const reclamo = await service.cerrarReclamo(id, body, req.fasUserId!)
  return reply.send({ data: reclamo })
}

export async function reabrir(req: FastifyRequest, reply: FastifyReply) {
  const { id } = reclamoParamsSchema.parse(req.params)
  const reclamo = await service.reabrirReclamo(id, req.fasUserId!)
  return reply.send({ data: reclamo })
}

// ─── Documentos ─────────────────────────────────────────────────────────────

export async function subirDocumento(req: FastifyRequest, reply: FastifyReply) {
  const { id } = reclamoParamsSchema.parse(req.params)
  const archivo = await req.file()
  if (!archivo) throw new ValidationError('No se recibió ningún archivo')
  const datos = await archivo.toBuffer()
  const resultado = await service.subirDocumento(id, { nombre: archivo.filename, mime: archivo.mimetype, datos }, req.fasUserId!)
  return reply.status(201).send({ data: resultado })
}

export async function descargarDocumento(req: FastifyRequest, reply: FastifyReply) {
  const { id, documentoId } = reclamoDocumentoParamsSchema.parse(req.params)
  const { meta, datos } = await service.descargarDocumento(id, documentoId)
  reply.header('Content-Type', meta.mime)
  reply.header('Content-Disposition', `attachment; filename="${meta.nombre}"`)
  return reply.send(datos)
}

export async function eliminarDocumento(req: FastifyRequest, reply: FastifyReply) {
  const { id, documentoId } = reclamoDocumentoParamsSchema.parse(req.params)
  await service.eliminarDocumento(id, documentoId, req.fasUserId!)
  return reply.status(204).send()
}

// ─── API externa (sin sesión FAS — requireReclamosApiKey) ──────────────────
// Sin requireAuth no hay empresaId en el contexto ALS — se resuelve el
// tenant del propio Reclamo primero y se setea el store antes de tocar
// cualquier modelo tenant (mismo patrón que el webhook AGL360).

export async function listarDocumentosExterno(req: FastifyRequest, reply: FastifyReply) {
  const { id } = reclamoParamsSchema.parse(req.params)
  const empresaId = await service.resolverEmpresaDeReclamo(id)
  const store = empresaContext.getStore()
  if (store) store.empresaId = empresaId
  const documentos = await service.listarDocumentosExterno(id)
  return reply.send({ data: documentos })
}

export async function descargarDocumentoExterno(req: FastifyRequest, reply: FastifyReply) {
  const { id, documentoId } = reclamoDocumentoParamsSchema.parse(req.params)
  const empresaId = await service.resolverEmpresaDeReclamo(id)
  const store = empresaContext.getStore()
  if (store) store.empresaId = empresaId
  const { meta, datos } = await service.descargarDocumentoExterno(id, documentoId)
  reply.header('Content-Type', meta.mime)
  reply.header('Content-Disposition', `attachment; filename="${meta.nombre}"`)
  return reply.send(datos)
}

// ─── Provisiones ────────────────────────────────────────────────────────────

export async function crearProvision(req: FastifyRequest, reply: FastifyReply) {
  const { id } = reclamoParamsSchema.parse(req.params)
  const body = provisionCreateSchema.parse(req.body)
  const provision = await service.crearProvision(id, body, req.fasUserId!)
  return reply.status(201).send({ data: provision })
}

export async function listarProvisiones(req: FastifyRequest, reply: FastifyReply) {
  const { id } = reclamoParamsSchema.parse(req.params)
  const provisiones = await service.listarProvisiones(id)
  return reply.send({ data: provisiones })
}

export async function reversarProvision(req: FastifyRequest, reply: FastifyReply) {
  const { id } = provisionParamsSchema.parse(req.params)
  const provision = await service.reversarProvision(id, req.fasUserId!)
  return reply.send({ data: provision })
}
