import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma.js'
import { empresaContext } from '../../src/lib/empresa-context.js'
import * as service from '../../src/modules/ventas/embarques/embarques.service.js'
import * as integracionesRepo from '../../src/modules/config/integraciones/integraciones.repository.js'

// Gestor Logístico + reserva manual (2026-09-07, ventas.md §4.3, generaliza
// el hardcode a AGL360) contra Postgres real: elección del gestor al generar
// el Embarque (automático vs manual), "Dejar Manual", guardado de datos de
// booking a mano, y re-resolución del modo en cada reintento (IMP-QA-R1-016).
//
// AGL_PROVIDER=mock (default de env.ts) — el "fallo" de la integración
// automática se fuerza sin parametrizar IdCliente/IdTipoEmbarque en la
// Integración (mismo camino que un cliente real sin configurar), no con
// AGL_MOCK_FALLA, para no depender de mutar process.env entre tests.

const databaseName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1)
if (databaseName !== 'fas_test') {
  throw new Error(`Seguridad: las pruebas de integración requieren fas_test; recibido "${databaseName}"`)
}

async function limpiarDatos() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "solicitudes_reserva",
      "embarques",
      "notas_venta",
      "integraciones",
      "entidades",
      "prefijos_codigo",
      "tipos_embarque",
      "mercados",
      "grupos_mercado",
      "monedas",
      "paises"
    RESTART IDENTITY CASCADE
  `)
}

async function obtenerEmpresaTest() {
  const existente = await prisma.empresa.findFirst({ where: { codigo: 'EMP-TEST-EGL' } })
  if (existente) return existente
  return prisma.empresa.create({ data: { codigo: 'EMP-TEST-EGL', razonSocial: 'Empresa de prueba (embarques/gestor)', creadoPor: 'test' } })
}

async function crearFixturesBase() {
  const empresa = await obtenerEmpresaTest()
  const pais = await prisma.pais.create({ data: { codigo: 'CHL', descripcion: 'Chile', creadoPor: 'test' } })
  const grupoMercado = await prisma.grupoMercado.create({ data: { empresaId: empresa.id, codigo: 'GM1', descripcion: 'Grupo 1', creadoPor: 'test' } })
  const mercado = await prisma.mercado.create({ data: { empresaId: empresa.id, codigo: 'MK1', descripcion: 'Mercado 1', grupoMercadoId: grupoMercado.id, creadoPor: 'test' } })
  const cliente = await prisma.entidad.create({
    data: { empresaId: empresa.id, codigo: 'CLI-01', descripcion: 'Cliente Uno', razonSocial: 'Cliente Uno SpA', paisId: pais.id, tipos: ['CLIENTE_NACIONAL'], creadoPor: 'test' },
  })
  const tipoEmbarque = await prisma.tipoEmbarque.create({ data: { empresaId: empresa.id, codigo: 'MARIT', descripcion: 'Marítimo', creadoPor: 'test' } })
  const moneda = await prisma.moneda.create({ data: { codigo: 'USD', descripcion: 'Dólar', creadoPor: 'test' } })
  await prisma.prefijoCodigo.create({
    data: { empresaId: empresa.id, modelo: 'embarque', tipoEmbarqueId: tipoEmbarque.id, prefijo: 'EMB-', digitos: 4, creadoPor: 'test' },
  })

  const gestorAutomatico = await prisma.entidad.create({
    data: { empresaId: empresa.id, codigo: 'GL-AUTO', descripcion: 'Gestor automático', razonSocial: 'Gestor automático SpA', paisId: pais.id, tipos: ['GESTOR_LOGISTICO'], creadoPor: 'test' },
  })
  const gestorManual = await prisma.entidad.create({
    data: { empresaId: empresa.id, codigo: 'GL-MANUAL', descripcion: 'Gestor manual', razonSocial: 'Gestor manual SpA', paisId: pais.id, tipos: ['GESTOR_LOGISTICO'], creadoPor: 'test' },
  })

  const integracion = await prisma.integracion.create({
    data: { empresaId: empresa.id, codigo: 'AGL360', descripcion: 'AGL360', activo: true, gestorLogisticoId: gestorAutomatico.id, creadoPor: 'test' },
  })
  // Sin estos dos parámetros, intentarReservaAgl falla igual que un cliente
  // real que no terminó de configurar la Integración — se usa como el
  // "camino de fallo" de la integración automática en los tests de abajo.
  async function habilitarParametrosAgl() {
    await integracionesRepo.addParametro(integracion.id, {
      idExterno: 'IdCliente', tipo: 'MAESTRO', maestro: 'ENTIDAD', maestroId: cliente.id, valorLocal: String(cliente.id), valorExterno: '9001',
    })
    await integracionesRepo.addParametro(integracion.id, {
      idExterno: 'IdTipoEmbarque', tipo: 'MAESTRO', maestro: 'TIPO_EMBARQUE', maestroId: tipoEmbarque.id, valorLocal: String(tipoEmbarque.id), valorExterno: '5001',
    })
  }

  let folio = 0
  async function crearNotaVenta() {
    folio += 1
    return prisma.notaVenta.create({
      data: {
        empresaId: empresa.id, folio, fecha: new Date(),
        clienteId: cliente.id, tipoEmbarqueId: tipoEmbarque.id, mercadoId: mercado.id,
        paisDestinoId: pais.id, monedaId: moneda.id, creadoPor: 'test',
      },
    })
  }

  return { empresa, cliente, tipoEmbarque, gestorAutomatico, gestorManual, integracion, habilitarParametrosAgl, crearNotaVenta }
}

describe('Embarques — Gestor Logístico + reserva manual contra PostgreSQL', () => {
  beforeEach(limpiarDatos)
  afterEach(() => {
    delete process.env.AGL_MOCK_FALLA
  })
  afterAll(async () => {
    await limpiarDatos()
    await prisma.$disconnect()
  })

  it('rechaza generar el Embarque con un gestorLogisticoId inexistente o que no es tipo Gestor Logístico', async () => {
    const f = await crearFixturesBase()
    await empresaContext.run({ empresaId: f.empresa.id }, async () => {
      const nv = await f.crearNotaVenta()

      await expect(
        service.generarEmbarque({ notaVentaId: nv.id, gestorLogisticoId: 999_999 }, 'test'),
      ).rejects.toMatchObject({ statusCode: 422 })

      await expect(
        service.generarEmbarque({ notaVentaId: nv.id, gestorLogisticoId: f.cliente.id }, 'test'),
      ).rejects.toMatchObject({ statusCode: 422 })
    })
  })

  it('camino automático: gestor con Integración activa y bien configurada -> SOLICITADA + SolicitudReserva', async () => {
    const f = await crearFixturesBase()
    await f.habilitarParametrosAgl()
    await empresaContext.run({ empresaId: f.empresa.id }, async () => {
      const nv = await f.crearNotaVenta()

      const embarque = await service.generarEmbarque({ notaVentaId: nv.id, gestorLogisticoId: f.gestorAutomatico.id }, 'test')

      expect(embarque.estadoReserva).toBe('SOLICITADA')
      expect(embarque.reservaManual).toBe(false)
      expect(embarque.gestorLogisticoId).toBe(f.gestorAutomatico.id)
      const solicitud = await prisma.solicitudReserva.findFirst({ where: { embarqueId: embarque.id } })
      expect(solicitud).not.toBeNull()
    })
  })

  it('camino automático que falla sin forzarSinReserva: aborta todo, no crea el Embarque', async () => {
    const f = await crearFixturesBase()
    // Integración vinculada pero sin los parámetros IdCliente/IdTipoEmbarque.
    await empresaContext.run({ empresaId: f.empresa.id }, async () => {
      const nv = await f.crearNotaVenta()

      await expect(
        service.generarEmbarque({ notaVentaId: nv.id, gestorLogisticoId: f.gestorAutomatico.id }, 'test'),
      ).rejects.toMatchObject({ statusCode: 502 })

      const count = await prisma.embarque.count()
      expect(count).toBe(0)
    })
  })

  it('camino automático que falla con forzarSinReserva=true: crea el Embarque en PENDIENTE, sin SolicitudReserva', async () => {
    const f = await crearFixturesBase()
    await empresaContext.run({ empresaId: f.empresa.id }, async () => {
      const nv = await f.crearNotaVenta()

      const embarque = await service.generarEmbarque(
        { notaVentaId: nv.id, gestorLogisticoId: f.gestorAutomatico.id, forzarSinReserva: true },
        'test',
      )

      expect(embarque.estadoReserva).toBe('PENDIENTE')
      expect(embarque.reservaManual).toBe(false)
      const solicitud = await prisma.solicitudReserva.findFirst({ where: { embarqueId: embarque.id } })
      expect(solicitud).toBeNull()
    })
  })

  it('camino manual: gestor sin Integración vinculada nace directo en reservaManual=true, sin intentar nada', async () => {
    const f = await crearFixturesBase()
    await empresaContext.run({ empresaId: f.empresa.id }, async () => {
      const nv = await f.crearNotaVenta()

      const embarque = await service.generarEmbarque({ notaVentaId: nv.id, gestorLogisticoId: f.gestorManual.id }, 'test')

      expect(embarque.reservaManual).toBe(true)
      expect(embarque.estadoReserva).toBe('PENDIENTE')
      const solicitud = await prisma.solicitudReserva.findFirst({ where: { embarqueId: embarque.id } })
      expect(solicitud).toBeNull()
    })
  })

  it('camino manual: gestor con Integración vinculada pero inactiva también cae a manual', async () => {
    const f = await crearFixturesBase()
    await f.habilitarParametrosAgl()
    await prisma.integracion.update({ where: { id: f.integracion.id }, data: { activo: false } })
    await empresaContext.run({ empresaId: f.empresa.id }, async () => {
      const nv = await f.crearNotaVenta()

      const embarque = await service.generarEmbarque({ notaVentaId: nv.id, gestorLogisticoId: f.gestorAutomatico.id }, 'test')

      expect(embarque.reservaManual).toBe(true)
      expect(embarque.estadoReserva).toBe('PENDIENTE')
    })
  })

  it('"Dejar Manual" habilita el tipeo directo desde un Embarque PENDIENTE no manual, y rechaza si ya está en otro estado', async () => {
    const f = await crearFixturesBase()
    await empresaContext.run({ empresaId: f.empresa.id }, async () => {
      const nv = await f.crearNotaVenta()
      const embarque = await service.generarEmbarque(
        { notaVentaId: nv.id, gestorLogisticoId: f.gestorAutomatico.id, forzarSinReserva: true },
        'test',
      )
      expect(embarque.reservaManual).toBe(false)

      const marcado = await service.dejarReservaManual(embarque.id, 'test')
      expect(marcado.reservaManual).toBe(true)

      await expect(service.dejarReservaManual(embarque.id, 'test')).rejects.toMatchObject({ statusCode: 422 })

      await f.habilitarParametrosAgl()
      const nv2 = await f.crearNotaVenta()
      const confirmadoAuto = await service.generarEmbarque({ notaVentaId: nv2.id, gestorLogisticoId: f.gestorAutomatico.id }, 'test')
      await expect(service.dejarReservaManual(confirmadoAuto.id, 'test')).rejects.toMatchObject({ statusCode: 422 })
    })
  })

  it('guardarDatosReservaManual exige reservaManual=true, guarda los datos y confirma de inmediato', async () => {
    const f = await crearFixturesBase()
    await empresaContext.run({ empresaId: f.empresa.id }, async () => {
      const nv = await f.crearNotaVenta()
      const embarque = await service.generarEmbarque({ notaVentaId: nv.id, gestorLogisticoId: f.gestorManual.id }, 'test')

      const datos = {
        numeroBooking: 'BK-001', naviera: 'Naviera X', nave: 'Nave X',
        numeroContenedor: 'CONT-001', fechaZarpe: new Date('2026-10-01'), fechaRetiroPlanta: new Date('2026-09-28'),
      }
      const guardado = await service.guardarDatosReservaManual(embarque.id, datos, 'test')

      expect(guardado.estadoReserva).toBe('CONFIRMADA')
      expect(guardado.numeroBookingManual).toBe('BK-001')
      expect(guardado.navieraManual).toBe('Naviera X')

      // Editable después — no se bloquea tras la primera confirmación.
      const reeditado = await service.guardarDatosReservaManual(embarque.id, { ...datos, naviera: 'Naviera Y' }, 'test')
      expect(reeditado.navieraManual).toBe('Naviera Y')
    })
  })

  it('guardarDatosReservaManual rechaza un Embarque que no está en modo manual', async () => {
    const f = await crearFixturesBase()
    await f.habilitarParametrosAgl()
    await empresaContext.run({ empresaId: f.empresa.id }, async () => {
      const nv = await f.crearNotaVenta()
      const embarque = await service.generarEmbarque({ notaVentaId: nv.id, gestorLogisticoId: f.gestorAutomatico.id }, 'test')

      await expect(
        service.guardarDatosReservaManual(embarque.id, { numeroBooking: 'BK-002' }, 'test'),
      ).rejects.toMatchObject({ statusCode: 422 })
    })
  })

  it('IMP-QA-R1-016: el reintento re-resuelve el modo automático — si la Integración se desvinculó, cae a manual en vez de reintentar', async () => {
    const f = await crearFixturesBase()
    await empresaContext.run({ empresaId: f.empresa.id }, async () => {
      const nv = await f.crearNotaVenta()
      const embarque = await service.generarEmbarque(
        { notaVentaId: nv.id, gestorLogisticoId: f.gestorAutomatico.id, forzarSinReserva: true },
        'test',
      )
      expect(embarque.estadoReserva).toBe('PENDIENTE')

      // Se desvincula la Integración del gestor entre el fallo y el reintento.
      await prisma.integracion.update({ where: { id: f.integracion.id }, data: { gestorLogisticoId: null } })

      await expect(service.solicitarReservaParaEmbarque(embarque.id, 'test')).rejects.toMatchObject({ statusCode: 422 })
    })
  })

  it('reintento manual exitoso cuando la Integración sigue vinculada y activa: pasa a SOLICITADA', async () => {
    const f = await crearFixturesBase()
    await empresaContext.run({ empresaId: f.empresa.id }, async () => {
      const nv = await f.crearNotaVenta()
      const embarque = await service.generarEmbarque(
        { notaVentaId: nv.id, gestorLogisticoId: f.gestorAutomatico.id, forzarSinReserva: true },
        'test',
      )
      expect(embarque.estadoReserva).toBe('PENDIENTE')

      await f.habilitarParametrosAgl()
      const reintentado = await service.solicitarReservaParaEmbarque(embarque.id, 'test')

      expect(reintentado.estadoReserva).toBe('SOLICITADA')
    })
  })

  it('rechaza reintentar la Solicitud de Reserva sobre un Embarque en modo manual', async () => {
    const f = await crearFixturesBase()
    await empresaContext.run({ empresaId: f.empresa.id }, async () => {
      const nv = await f.crearNotaVenta()
      const embarque = await service.generarEmbarque({ notaVentaId: nv.id, gestorLogisticoId: f.gestorManual.id }, 'test')

      await expect(service.solicitarReservaParaEmbarque(embarque.id, 'test')).rejects.toMatchObject({ statusCode: 422 })
    })
  })
})
