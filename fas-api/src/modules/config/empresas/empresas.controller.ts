import type { FastifyRequest, FastifyReply } from 'fastify'
import * as service from './empresas.service.js'
import {
  empresaCreateSchema,
  empresaUpdateSchema,
  empresaIdParamSchema,
  empresaDireccionParamSchema,
  empresaContactoParamSchema,
  empresaListQuerySchema,
  direccionCreateSchema,
  direccionUpdateSchema,
  contactoCreateSchema,
  contactoUpdateSchema,
} from './empresas.schema.js'

// ─── Empresas ─────────────────────────────────────────────────────────────────

export async function listEmpresas(req: FastifyRequest, reply: FastifyReply) {
  const query = empresaListQuerySchema.parse(req.query)
  const result = await service.listarEmpresas(query.page, query.limit, query.q, query.activo)
  return reply.send(result)
}

export async function getEmpresaById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = empresaIdParamSchema.parse(req.params)
  const result = await service.obtenerEmpresa(id)
  return reply.send(result)
}

export async function createEmpresa(req: FastifyRequest, reply: FastifyReply) {
  const input = empresaCreateSchema.parse(req.body)
  const result = await service.crearEmpresa(input, req.fasUserId!)
  return reply.status(201).send(result)
}

export async function updateEmpresa(req: FastifyRequest, reply: FastifyReply) {
  const { id } = empresaIdParamSchema.parse(req.params)
  const input = empresaUpdateSchema.parse(req.body)
  const result = await service.actualizarEmpresa(id, input, req.fasUserId!)
  return reply.send(result)
}

export async function deleteEmpresa(req: FastifyRequest, reply: FastifyReply) {
  const { id } = empresaIdParamSchema.parse(req.params)
  await service.eliminarEmpresa(id, req.fasUserId!)
  return reply.status(204).send()
}

// ─── Direcciones ──────────────────────────────────────────────────────────────

export async function createDireccion(req: FastifyRequest, reply: FastifyReply) {
  const { id } = empresaIdParamSchema.parse(req.params)
  const input = direccionCreateSchema.parse(req.body)
  const result = await service.crearDireccion(id, input, req.fasUserId!)
  return reply.status(201).send(result)
}

export async function updateDireccion(req: FastifyRequest, reply: FastifyReply) {
  const { id, dirId } = empresaDireccionParamSchema.parse(req.params)
  const input = direccionUpdateSchema.parse(req.body)
  const result = await service.actualizarDireccion(id, dirId, input, req.fasUserId!)
  return reply.send(result)
}

export async function deleteDireccion(req: FastifyRequest, reply: FastifyReply) {
  const { id, dirId } = empresaDireccionParamSchema.parse(req.params)
  await service.eliminarDireccion(id, dirId, req.fasUserId!)
  return reply.status(204).send()
}

// ─── Contactos ────────────────────────────────────────────────────────────────

export async function createContacto(req: FastifyRequest, reply: FastifyReply) {
  const { id } = empresaIdParamSchema.parse(req.params)
  const input = contactoCreateSchema.parse(req.body)
  const result = await service.crearContacto(id, input, req.fasUserId!)
  return reply.status(201).send(result)
}

export async function updateContacto(req: FastifyRequest, reply: FastifyReply) {
  const { id, conId } = empresaContactoParamSchema.parse(req.params)
  const input = contactoUpdateSchema.parse(req.body)
  const result = await service.actualizarContacto(id, conId, input, req.fasUserId!)
  return reply.send(result)
}

export async function deleteContacto(req: FastifyRequest, reply: FastifyReply) {
  const { id, conId } = empresaContactoParamSchema.parse(req.params)
  await service.eliminarContacto(id, conId, req.fasUserId!)
  return reply.status(204).send()
}
