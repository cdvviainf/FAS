import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma.js'
import {
  actualizarMantenedor,
  crearMantenedor,
  eliminarMantenedor,
} from '../../src/modules/config/config.service.js'

const databaseName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1)
if (databaseName !== 'fas_test') {
  throw new Error(`Seguridad: las pruebas de integración requieren fas_test; recibido "${databaseName}"`)
}

async function limpiarDatos() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "entidad_contactos",
      "entidad_direcciones",
      "entidades",
      "bodega_contactos",
      "bodegas",
      "comunas",
      "provincias",
      "regiones",
      "temporadas",
      "paises"
    RESTART IDENTITY CASCADE
  `)
}

async function crearGeografia() {
  const pais = await prisma.pais.create({
    data: { codigo: 'CHL', descripcion: 'Chile', creadoPor: 'test' },
  })
  const region = await prisma.region.create({
    data: { codigo: 'RM', descripcion: 'Metropolitana', creadoPor: 'test' },
  })
  const provincia = await prisma.provincia.create({
    data: {
      codigo: 'STGO',
      descripcion: 'Santiago',
      regionId: region.id,
      creadoPor: 'test',
    },
  })
  const comuna = await prisma.comuna.create({
    data: {
      codigo: 'PROV',
      descripcion: 'Providencia',
      provinciaId: provincia.id,
      creadoPor: 'test',
    },
  })
  return { pais, region, provincia, comuna }
}

describe('mantenedores contra PostgreSQL', () => {
  beforeEach(limpiarDatos)
  afterAll(async () => {
    await limpiarDatos()
    await prisma.$disconnect()
  })

  it('garantiza una temporada predeterminada desde el primer registro', async () => {
    const temporada = await crearMantenedor('temporada', {
      codigo: '2026-2027',
      descripcion: 'Temporada 2026-2027',
      fechaInicio: '2026-07-01',
      fechaTermino: '2027-06-30',
      predeterminada: false,
    })

    expect(temporada.predeterminada).toBe(true)
    await expect(eliminarMantenedor('temporada', temporada.id)).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('bloquea soft delete con hijos vigentes y lo permite al eliminarlos', async () => {
    const { region, provincia } = await crearGeografia()

    await expect(eliminarMantenedor('region', region.id)).rejects.toMatchObject({
      statusCode: 409,
    })

    await prisma.provincia.update({
      where: { id: provincia.id },
      data: { eliminadoEn: new Date(), eliminadoPor: 'test' },
    })
    await eliminarMantenedor('region', region.id, 'test')

    const eliminada = await prisma.region.findUnique({ where: { id: region.id } })
    expect(eliminada?.eliminadoEn).toBeInstanceOf(Date)
  })

  it('bloquea eliminar una comuna usada por una dirección vigente', async () => {
    const { pais, comuna } = await crearGeografia()
    const entidad = await prisma.entidad.create({
      data: {
        codigo: 'CLI-1',
        descripcion: 'Cliente prueba',
        razonSocial: 'Cliente prueba SpA',
        paisId: pais.id,
        tipos: ['CLIENTE_NACIONAL'],
        creadoPor: 'test',
      },
    })
    await prisma.entidadDireccion.create({
      data: {
        entidadId: entidad.id,
        codigo: 'CASA',
        paisId: pais.id,
        comunaId: comuna.id,
        direccion: 'Dirección de prueba',
        creadoPor: 'test',
      },
    })

    await expect(eliminarMantenedor('comuna', comuna.id)).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('permite inactivar un registro aunque esté en uso', async () => {
    const { region } = await crearGeografia()

    const actualizada = await actualizarMantenedor('region', region.id, {
      bloqueado: true,
    })

    expect(actualizada.bloqueado).toBe(true)
  })

  it('permite reutilizar un código después del soft delete', async () => {
    const pais = await crearMantenedor('pais', {
      codigo: 'ARG',
      descripcion: 'Argentina',
    })
    await eliminarMantenedor('pais', pais.id, 'test')

    const reemplazo = await crearMantenedor('pais', {
      codigo: 'ARG',
      descripcion: 'Argentina nueva',
    })

    expect(reemplazo.id).not.toBe(pais.id)
  })
})
