import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma.js'
import { empresaContext } from '../../src/lib/empresa-context.js'
import * as service from '../../src/modules/config/integraciones/integraciones.service.js'

// Vinculación Integracion <-> Gestor Logístico (2026-09-07, ventas.md §4.3,
// Docs/integraciones.md R8/R2) contra Postgres real: valida existencia+tipo
// de la Entidad, unicidad (empresaId, gestorLogisticoId) y la liberación del
// vínculo al hacer soft delete (IMP-QA-R2-018).

const databaseName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1)
if (databaseName !== 'fas_test') {
  throw new Error(`Seguridad: las pruebas de integración requieren fas_test; recibido "${databaseName}"`)
}

async function limpiarDatos() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "integraciones",
      "entidades",
      "paises"
    RESTART IDENTITY CASCADE
  `)
}

async function obtenerEmpresaTest() {
  const existente = await prisma.empresa.findFirst({ where: { codigo: 'EMP-TEST-INTGL' } })
  if (existente) return existente
  return prisma.empresa.create({ data: { codigo: 'EMP-TEST-INTGL', razonSocial: 'Empresa de prueba (integraciones/gestor)', creadoPor: 'test' } })
}

async function obtenerPaisTest() {
  const existente = await prisma.pais.findFirst({ where: { codigo: 'CHL' } })
  if (existente) return existente
  return prisma.pais.create({ data: { codigo: 'CHL', descripcion: 'Chile', creadoPor: 'test' } })
}

async function crearGestor(empresaId: number, codigo: string, opts: { activo?: boolean } = {}) {
  const pais = await obtenerPaisTest()
  return prisma.entidad.create({
    data: {
      empresaId,
      codigo,
      descripcion: `Gestor ${codigo}`,
      razonSocial: `Gestor ${codigo} SpA`,
      paisId: pais.id,
      tipos: ['GESTOR_LOGISTICO'],
      activo: opts.activo ?? true,
      creadoPor: 'test',
    },
  })
}

async function crearCliente(empresaId: number, codigo: string) {
  const pais = await obtenerPaisTest()
  return prisma.entidad.create({
    data: {
      empresaId,
      codigo,
      descripcion: `Cliente ${codigo}`,
      razonSocial: `Cliente ${codigo} SpA`,
      paisId: pais.id,
      tipos: ['CLIENTE_NACIONAL'],
      creadoPor: 'test',
    },
  })
}

describe('Integraciones — vínculo con Gestor Logístico contra PostgreSQL', () => {
  beforeEach(limpiarDatos)
  afterAll(async () => {
    await limpiarDatos()
    await prisma.$disconnect()
  })

  it('crea una Integración vinculada a un Gestor Logístico válido', async () => {
    const empresa = await obtenerEmpresaTest()
    await empresaContext.run({ empresaId: empresa.id }, async () => {
      const gestor = await crearGestor(empresa.id, 'GL-1')

      const creada = await service.crearIntegracion(
        { codigo: 'AGL360', descripcion: 'AGL360', activo: true, gestorLogisticoId: gestor.id },
        'test',
      )

      expect(creada.gestorLogisticoId).toBe(gestor.id)
    })
  })

  it('rechaza vincular una Entidad que no existe, está inactiva, o no es tipo Gestor Logístico', async () => {
    const empresa = await obtenerEmpresaTest()
    await empresaContext.run({ empresaId: empresa.id }, async () => {
      const clienteComoGestor = await crearCliente(empresa.id, 'CLI-1')
      const gestorInactivo = await crearGestor(empresa.id, 'GL-INACTIVO', { activo: false })

      await expect(
        service.crearIntegracion({ codigo: 'AGL360', descripcion: 'AGL360', gestorLogisticoId: 999_999 }, 'test'),
      ).rejects.toMatchObject({ statusCode: 422 })

      await expect(
        service.crearIntegracion({ codigo: 'AGL360', descripcion: 'AGL360', gestorLogisticoId: clienteComoGestor.id }, 'test'),
      ).rejects.toMatchObject({ statusCode: 422 })

      await expect(
        service.crearIntegracion({ codigo: 'AGL360', descripcion: 'AGL360', gestorLogisticoId: gestorInactivo.id }, 'test'),
      ).rejects.toMatchObject({ statusCode: 422 })
    })
  })

  it('rechaza vincular un Gestor Logístico que ya tiene otra Integración activa', async () => {
    const empresa = await obtenerEmpresaTest()
    await empresaContext.run({ empresaId: empresa.id }, async () => {
      const gestor = await crearGestor(empresa.id, 'GL-2')
      await service.crearIntegracion({ codigo: 'AGL360', descripcion: 'AGL360', gestorLogisticoId: gestor.id }, 'test')

      await expect(
        service.crearIntegracion({ codigo: 'OTRA', descripcion: 'Otra integración', gestorLogisticoId: gestor.id }, 'test'),
      ).rejects.toMatchObject({ statusCode: 422 })
    })
  })

  it('permite reasignar el mismo Gestor Logístico a la misma Integración al editar (excluye la propia fila)', async () => {
    const empresa = await obtenerEmpresaTest()
    await empresaContext.run({ empresaId: empresa.id }, async () => {
      const gestor = await crearGestor(empresa.id, 'GL-3')
      const creada = await service.crearIntegracion({ codigo: 'AGL360', descripcion: 'AGL360', gestorLogisticoId: gestor.id }, 'test')

      const actualizada = await service.actualizarIntegracion(creada.id, { descripcion: 'AGL360 v2', gestorLogisticoId: gestor.id }, 'test')

      expect(actualizada?.descripcion).toBe('AGL360 v2')
      expect(actualizada?.gestorLogisticoId).toBe(gestor.id)
    })
  })

  it('bloquea reasignar a otra Integración un Gestor Logístico ya vinculado', async () => {
    const empresa = await obtenerEmpresaTest()
    await empresaContext.run({ empresaId: empresa.id }, async () => {
      const gestor = await crearGestor(empresa.id, 'GL-4')
      await service.crearIntegracion({ codigo: 'AGL360', descripcion: 'AGL360', gestorLogisticoId: gestor.id }, 'test')
      const sinGestor = await service.crearIntegracion({ codigo: 'OTRA', descripcion: 'Otra integración' }, 'test')

      await expect(
        service.actualizarIntegracion(sinGestor.id, { gestorLogisticoId: gestor.id }, 'test'),
      ).rejects.toMatchObject({ statusCode: 422 })
    })
  })

  it('libera el vínculo con el Gestor Logístico al hacer soft delete (IMP-QA-R2-018)', async () => {
    const empresa = await obtenerEmpresaTest()
    await empresaContext.run({ empresaId: empresa.id }, async () => {
      const gestor = await crearGestor(empresa.id, 'GL-5')
      const creada = await service.crearIntegracion({ codigo: 'AGL360', descripcion: 'AGL360', gestorLogisticoId: gestor.id }, 'test')

      await service.eliminarIntegracion(creada.id, 'test')

      const eliminada = await prisma.integracion.findUnique({ where: { id: creada.id } })
      expect(eliminada?.eliminadoEn).toBeInstanceOf(Date)
      expect(eliminada?.gestorLogisticoId).toBeNull()

      // El gestor queda libre de inmediato para una nueva Integración, sin
      // exigir restaurar/reemplazar la eliminada primero.
      const nueva = await service.crearIntegracion({ codigo: 'AGL360-B', descripcion: 'AGL360 reemplazo', gestorLogisticoId: gestor.id }, 'test')
      expect(nueva.gestorLogisticoId).toBe(gestor.id)
    })
  })
})
