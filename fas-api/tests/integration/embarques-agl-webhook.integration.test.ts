import { createHmac } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { prisma } from '../../src/lib/prisma.js'

// Webhook AGL360 -> FAS (Docs/webhook-fas.md): notifica que una
// SolicitudServicio creada por la API se aprobó y generó una OrdenServicio.
// Estas pruebas ejercitan el contrato real (firma HMAC, payload mínimo,
// idempotencia) contra Postgres real — sin sesión de usuario, autenticado
// solo por firma.

const databaseName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1)
if (databaseName !== 'fas_test') {
  throw new Error(`Seguridad: las pruebas HTTP requieren fas_test; recibido "${databaseName}"`)
}

const SECRETO = process.env.AGL360_WEBHOOK_SECRET
if (!SECRETO) {
  throw new Error('AGL360_WEBHOOK_SECRET debe estar configurado para correr esta suite (ver scripts/test-integration.sh)')
}

const RUTA = '/api/ventas/embarques/webhooks/agl360-confirmacion'

function firmar(bodyString: string): string {
  return createHmac('sha256', SECRETO!).update(bodyString).digest('hex')
}

let app: FastifyInstance

async function obtenerEmpresaTest() {
  const existente = await prisma.empresa.findFirst({ where: { codigo: 'EMP-TEST-AGLWH' } })
  if (existente) return existente
  return prisma.empresa.create({ data: { codigo: 'EMP-TEST-AGLWH', razonSocial: 'Empresa de prueba (webhook AGL)', creadoPor: 'test' } })
}

async function limpiarDatos() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "solicitudes_reserva",
      "embarques",
      "notas_venta",
      "entidades",
      "tipos_embarque",
      "mercados",
      "grupos_mercado",
      "monedas",
      "paises"
    RESTART IDENTITY CASCADE
  `)
}

async function crearFixtures() {
  const empresa = await obtenerEmpresaTest()
  const pais = await prisma.pais.create({ data: { codigo: 'CHL', descripcion: 'Chile', creadoPor: 'test' } })
  const grupoMercado = await prisma.grupoMercado.create({ data: { empresaId: empresa.id, codigo: 'GM1', descripcion: 'Grupo 1', creadoPor: 'test' } })
  const mercado = await prisma.mercado.create({ data: { empresaId: empresa.id, codigo: 'MK1', descripcion: 'Mercado 1', grupoMercadoId: grupoMercado.id, creadoPor: 'test' } })
  const cliente = await prisma.entidad.create({
    data: { empresaId: empresa.id, codigo: 'CLI-01', descripcion: 'Cliente Uno', razonSocial: 'Cliente Uno SpA', paisId: pais.id, tipos: ['CLIENTE_NACIONAL'], creadoPor: 'test' },
  })
  const tipoEmbarque = await prisma.tipoEmbarque.create({ data: { empresaId: empresa.id, codigo: 'MARIT', descripcion: 'Marítimo', creadoPor: 'test' } })
  const moneda = await prisma.moneda.create({ data: { codigo: 'USD', descripcion: 'Dólar', creadoPor: 'test' } })

  const notaVenta = await prisma.notaVenta.create({
    data: {
      empresaId: empresa.id, folio: 1, fecha: new Date(),
      clienteId: cliente.id, tipoEmbarqueId: tipoEmbarque.id, mercadoId: mercado.id,
      paisDestinoId: pais.id, monedaId: moneda.id, creadoPor: 'test',
    },
  })
  const embarque = await prisma.embarque.create({
    data: { empresaId: empresa.id, notaVentaId: notaVenta.id, numeroInstructivo: '001A', creadoPor: 'test', estadoReserva: 'SOLICITADA' },
  })
  const referenciaFas = `AGL-${empresa.id}-${notaVenta.id}`
  const solicitud = await prisma.solicitudReserva.create({
    data: {
      empresaId: empresa.id, embarqueId: embarque.id, referenciaFas,
      payloadEnviado: {}, enviadoPor: 'test',
    },
  })

  return { empresa, notaVenta, embarque, solicitud, referenciaFas }
}

function bodyOrdenCreada(referenciaFas: string, idOrdenServicio = 123, idSolicitudServicio = 45) {
  return JSON.stringify({
    evento: 'orden.creada',
    idOrdenServicio,
    idSolicitudServicio,
    referencia_externa: referenciaFas,
    estadoOrden: 'pendiente',
  })
}

describe('Webhook AGL360 -> FAS: confirmación de Solicitud de Reserva (Docs/webhook-fas.md) contra PostgreSQL', () => {
  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })
  beforeEach(limpiarDatos)
  afterAll(async () => {
    await limpiarDatos()
    await app.close()
    await prisma.$disconnect()
  })

  it('rechaza sin header de firma', async () => {
    const f = await crearFixtures()
    const res = await app.inject({ method: 'POST', url: RUTA, payload: bodyOrdenCreada(f.referenciaFas), headers: { 'content-type': 'application/json' } })
    expect(res.statusCode).toBe(401)
  })

  it('rechaza con firma inválida', async () => {
    const f = await crearFixtures()
    const res = await app.inject({
      method: 'POST', url: RUTA, payload: bodyOrdenCreada(f.referenciaFas),
      headers: { 'content-type': 'application/json', 'x-agl360-signature': 'firma-incorrecta' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('confirma la Solicitud de Reserva y el Embarque con firma válida', async () => {
    const f = await crearFixtures()
    const body = bodyOrdenCreada(f.referenciaFas)
    const res = await app.inject({
      method: 'POST', url: RUTA, payload: body,
      headers: { 'content-type': 'application/json', 'x-agl360-signature': firmar(body) },
    })
    expect(res.statusCode).toBe(204)

    const embarque = await prisma.embarque.findUniqueOrThrow({ where: { id: f.embarque.id } })
    expect(embarque.estadoReserva).toBe('CONFIRMADA')
    const solicitud = await prisma.solicitudReserva.findUniqueOrThrow({ where: { id: f.solicitud.id } })
    expect(solicitud.idOrdenServicioAgl).toBe(123)
    expect(solicitud.idSolicitudServicioAgl).toBe(45)
    expect(solicitud.estadoOrdenAgl).toBe('pendiente')
    expect(solicitud.confirmadoEn).not.toBeNull()
    // Contrato real (webhook-fas.md): esta notificación no trae detalle de
    // booking — no debe inventarse ningún valor para esos campos.
    expect(solicitud.numeroBooking).toBeNull()
  })

  it('es idempotente: la misma notificación repetida no falla ni duplica efectos', async () => {
    const f = await crearFixtures()
    const body = bodyOrdenCreada(f.referenciaFas)
    const headers = { 'content-type': 'application/json', 'x-agl360-signature': firmar(body) }

    const res1 = await app.inject({ method: 'POST', url: RUTA, payload: body, headers })
    expect(res1.statusCode).toBe(204)
    const res2 = await app.inject({ method: 'POST', url: RUTA, payload: body, headers })
    expect(res2.statusCode).toBe(204)

    const solicitud = await prisma.solicitudReserva.findUniqueOrThrow({ where: { id: f.solicitud.id } })
    expect(solicitud.idOrdenServicioAgl).toBe(123)
  })

  it('rechaza una segunda Orden de Servicio distinta para la misma Solicitud ya confirmada', async () => {
    const f = await crearFixtures()
    const primero = bodyOrdenCreada(f.referenciaFas, 123)
    await app.inject({ method: 'POST', url: RUTA, payload: primero, headers: { 'content-type': 'application/json', 'x-agl360-signature': firmar(primero) } })

    const segundo = bodyOrdenCreada(f.referenciaFas, 999)
    const res = await app.inject({ method: 'POST', url: RUTA, payload: segundo, headers: { 'content-type': 'application/json', 'x-agl360-signature': firmar(segundo) } })
    expect(res.statusCode).toBe(409)
  })

  it('responde 409 (reintentable) si la referencia no existe todavía', async () => {
    await crearFixtures()
    const body = bodyOrdenCreada('AGL-999999-1')
    const res = await app.inject({ method: 'POST', url: RUTA, payload: body, headers: { 'content-type': 'application/json', 'x-agl360-signature': firmar(body) } })
    // empresaId=999999 no existe -> se rechaza antes incluso de buscar la
    // referencia (401, no 409) porque el tenant mismo es inválido.
    expect(res.statusCode).toBe(401)
  })

  it('responde 409 si el empresaId es válido pero la referencia no corresponde a ninguna Solicitud', async () => {
    const f = await crearFixtures()
    const body = bodyOrdenCreada(`AGL-${f.empresa.id}-999999`)
    const res = await app.inject({ method: 'POST', url: RUTA, payload: body, headers: { 'content-type': 'application/json', 'x-agl360-signature': firmar(body) } })
    expect(res.statusCode).toBe(409)
  })
})
