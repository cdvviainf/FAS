import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  embarqueCreateSchema,
  embarqueParamsSchema,
  embarqueListQuerySchema,
  reservarPalletsSchema,
  embarquePalletParamsSchema,
  aglWebhookConfirmarSchema,
  datosReservaManualSchema,
} from './embarques.schema.js'
import * as service from './embarques.service.js'
import { prisma } from '../../../lib/prisma.js'
import { empresaContext } from '../../../lib/empresa-context.js'
import { UnauthorizedError } from '../../../shared/errors.js'

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const { page, limit, notaVentaId } = embarqueListQuerySchema.parse(req.query)
  const result = await service.listarEmbarques(page, limit, notaVentaId)
  return reply.send(result)
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const embarque = await service.obtenerEmbarque(id)
  return reply.send({ data: embarque })
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const body = embarqueCreateSchema.parse(req.body)
  const embarque = await service.generarEmbarque(body, req.fasUserId!)
  return reply.status(201).send({ data: embarque })
}

// ─── Seleccionar Pallets ────────────────────────────────────────────────────

export async function listarPalletsDisponibles(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const data = await service.listarPalletsDisponibles(id)
  return reply.send({ data })
}

export async function agregarPallets(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const { palletIds } = reservarPalletsSchema.parse(req.body)
  const embarque = await service.agregarPallets(id, palletIds)
  return reply.status(201).send({ data: embarque })
}

export async function quitarPallet(req: FastifyRequest, reply: FastifyReply) {
  const { id, palletId } = embarquePalletParamsSchema.parse(req.params)
  const embarque = await service.quitarPallet(id, palletId)
  return reply.send({ data: embarque })
}

// ─── Despachar ──────────────────────────────────────────────────────────────

export async function despachar(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const embarque = await service.confirmarDespacho(id, req.fasUserId!)
  return reply.send({ data: embarque })
}

// ─── Solicitud de Reserva (ventas.md §4.3) ──────────────────────────────────

export async function solicitarReserva(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const embarque = await service.solicitarReservaParaEmbarque(id, req.fasUserId!)
  return reply.status(201).send({ data: embarque })
}

// "Dejar Manual" / datos de booking manual (2026-09-07, ventas.md §4.3).
export async function dejarReservaManual(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const embarque = await service.dejarReservaManual(id, req.fasUserId!)
  return reply.status(201).send({ data: embarque })
}

export async function guardarDatosReservaManual(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const body = datosReservaManualSchema.parse(req.body)
  const embarque = await service.guardarDatosReservaManual(id, body, req.fasUserId!)
  return reply.send({ data: embarque })
}

// `referencia_externa` = lo que FAS mandó como `referencia_externa` al crear
// la solicitud (Docs/api-solicitudes.md): formato determinístico
// `AGL-{empresaId}-{notaVentaId}` (embarques.service.ts). El webhook real
// (Docs/webhook-fas.md) NO trae `empresaId` — es un payload 100% de AGL360,
// no lo diseñamos nosotros — así que se extrae de acá antes de poder
// resolver el tenant.
const REGEX_REFERENCIA_FAS = /^AGL-(\d+)-\d+$/

// Webhook AGL360 -> FAS: sin sesión de usuario (autenticado por firma HMAC,
// ver embarques.routes.ts/auth-guard.ts). Se extrae `empresaId` de
// `referencia_externa`, se valida contra `Empresa` (no-tenant, no requiere
// contexto previo) y recién ahí se fija empresaContext para el resto de la
// operación — mismo mecanismo que requireAuth usa con el header
// X-Empresa-Id, pero resuelto desde el body en vez de una sesión.
export async function confirmarWebhookAgl(req: FastifyRequest, reply: FastifyReply) {
  const body = aglWebhookConfirmarSchema.parse(req.body)

  const match = REGEX_REFERENCIA_FAS.exec(body.referencia_externa)
  if (!match) {
    throw new UnauthorizedError(`referencia_externa con formato inesperado: "${body.referencia_externa}"`)
  }
  const empresaId = Number(match[1])

  const empresa = await prisma.empresa.findFirst({
    where: { id: empresaId, activo: true, eliminadoEn: null },
    select: { id: true },
  })
  if (!empresa) {
    throw new UnauthorizedError('empresaId inválido')
  }

  const store = empresaContext.getStore()
  if (store) store.empresaId = empresa.id

  await service.confirmarSolicitudDesdeWebhook(body)
  return reply.status(204).send()
}
