import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  embarqueCreateSchema,
  embarqueParamsSchema,
  embarqueReclamoParamsSchema,
  embarqueListQuerySchema,
  reservarPalletsSchema,
  embarquePalletParamsSchema,
  aglWebhookConfirmarSchema,
  datosReservaManualSchema,
  datosInstructivoSchema,
  instructivoHijoUpdateSchema,
  instructivoHijoParamsSchema,
  packingListUploadQuerySchema,
} from './embarques.schema.js'
import * as service from './embarques.service.js'
import { prisma } from '../../../lib/prisma.js'
import { empresaContext } from '../../../lib/empresa-context.js'
import { ForbiddenError, UnauthorizedError, ValidationError } from '../../../shared/errors.js'
import * as reclamosService from '../../calidad/reclamos/reclamos.service.js'
import { reclamoCreateSchema, reclamoUpdateSchema } from '../../calidad/reclamos/reclamos.schema.js'

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

// ─── Packing List (compras.md §9.3, cierra EP-QA-003) ──────────────────────

export async function subirPackingList(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const { templateCargaId } = packingListUploadQuerySchema.parse(req.query)

  const archivo = await req.file()
  if (!archivo) throw new ValidationError('No se recibió ningún archivo')
  const datos = await archivo.toBuffer()

  const resultado = await service.subirPackingList(
    id,
    templateCargaId,
    { nombre: archivo.filename, mime: archivo.mimetype, datos },
    req.fasUserId!,
  )
  return reply.status(201).send({ data: resultado })
}

export async function descargarPackingList(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const { meta, datos } = await service.descargarPackingList(id)
  return reply
    .header('Content-Type', meta.mime)
    .header('Content-Disposition', `attachment; filename="${encodeURIComponent(meta.nombreArchivo)}"`)
    .header('Content-Length', String(datos.length))
    .send(datos)
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

// ─── Instructivo de Embarque (2026-09-21, ventas.md R11) ───────────────────

export async function guardarDatosInstructivo(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const body = datosInstructivoSchema.parse(req.body)
  const embarque = await service.guardarDatosInstructivo(id, body, req.fasUserId!)
  return reply.send({ data: embarque })
}

export async function listarInstructivosHijos(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const data = await service.listarInstructivosHijos(id)
  return reply.send({ data })
}

export async function generarInstructivosHijos(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const data = await service.generarInstructivosHijos(id, req.fasUserId!)
  return reply.status(201).send({ data })
}

export async function actualizarInstructivoHijo(req: FastifyRequest, reply: FastifyReply) {
  const { id, instructivoId } = instructivoHijoParamsSchema.parse(req.params)
  const body = instructivoHijoUpdateSchema.parse(req.body)
  const data = await service.actualizarInstructivoHijo(id, instructivoId, body, req.fasUserId!)
  return reply.send({ data })
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

// ─── Reclamos (2026-09-08, reclamos.md) — se crean desde acá (Ventas), el
// resto del ciclo de vida (análisis, valorización, cierre, provisiones)
// vive en calidad/reclamos/reclamos.routes.ts. Handlers delgados: la lógica
// real es la misma que usa Calidad, solo cambia quién puede llamarlos
// (VENTAS_EMBARQUES en vez de CAL_RECLAMOS).

export async function listarLineasReclamables(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const lineas = await reclamosService.obtenerLineasReclamables(id)
  return reply.send({ data: lineas })
}

// IMP-QA-R2-024: crear el Reclamo solo exige VENTAS_EMBARQUES — si el body
// trae una Provisión inline, esa parte del payload exige el permiso
// específico RECLAMO_PROVISION (RC-D10), igual que el endpoint dedicado
// `POST /reclamos/:id/provisiones`. Chequeo condicional acá (no un
// preHandler fijo) porque solo aplica cuando el body realmente trae `provision`.
export async function crearReclamo(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const body = reclamoCreateSchema.parse(req.body)
  if (body.provision && req.fasAccesos?.get('RECLAMO_PROVISION') !== 'TOTAL') {
    throw new ForbiddenError('Se requiere el permiso de Provisión de Reclamo para agregar una Provisión inicial')
  }
  const reclamo = await reclamosService.crearReclamo(id, body, req.fasUserId!)
  return reply.status(201).send({ data: reclamo })
}

export async function listarReclamosDelEmbarque(req: FastifyRequest, reply: FastifyReply) {
  const { id } = embarqueParamsSchema.parse(req.params)
  const reclamos = await reclamosService.listarReclamosPorEmbarque(id)
  return reply.send({ data: reclamos })
}

// IMP-QA-R1-019: edición de cabecera/líneas — faltaba, estaba en el
// contrato de reclamos.md §6 desde el principio.
export async function actualizarReclamo(req: FastifyRequest, reply: FastifyReply) {
  const { id, reclamoId } = embarqueReclamoParamsSchema.parse(req.params)
  const body = reclamoUpdateSchema.parse(req.body)
  const reclamo = await reclamosService.actualizarReclamo(reclamoId, id, body, req.fasUserId!)
  return reply.send({ data: reclamo })
}
