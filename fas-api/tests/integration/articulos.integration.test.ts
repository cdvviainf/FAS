import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma.js'
import {
  actualizarArticulo,
  crearArticulo,
  obtenerArticulo,
} from '../../src/modules/materiales/articulos/articulos.service.js'
import { articuloCreateSchema, articuloListQuerySchema } from '../../src/modules/materiales/articulos/articulos.schema.js'

const databaseName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1)
if (databaseName !== 'fas_test') {
  throw new Error(`Seguridad: las pruebas de Artículos requieren fas_test; recibido "${databaseName}"`)
}

async function limpiarDatos() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "documentos_articulo_contenido",
      "documentos_articulo",
      "articulos",
      "unidades_medida"
    RESTART IDENTITY CASCADE
  `)
}

async function crearUnidad() {
  return prisma.unidadMedida.create({
    data: {
      codigo: 'UN',
      descripcion: 'Unidad',
      creadoPor: 'test',
    },
  })
}

describe('maestro de Artículos contra PostgreSQL', () => {
  beforeEach(limpiarDatos)
  afterAll(async () => {
    await limpiarDatos()
    await prisma.$disconnect()
  })

  it('CA1: rechaza costeo Estándar sin valor estándar', async () => {
    const unidad = await crearUnidad()

    await expect(crearArticulo({
      tipo: 'ENVASE',
      codigo: 'ENV-001',
      descripcion: 'Envase de prueba',
      unidadId: unidad.id,
      tipoCosteo: 'ESTANDAR',
    })).rejects.toMatchObject({ statusCode: 422 })
  })

  it('CA1: fuerza controlaStock=false para costeo Estándar', async () => {
    const unidad = await crearUnidad()

    const articulo = await crearArticulo({
      tipo: 'ENVASE',
      codigo: 'ENV-001',
      descripcion: 'Envase de prueba',
      unidadId: unidad.id,
      tipoCosteo: 'ESTANDAR',
      valorEstandar: 1250.5,
    })

    expect(articulo.controlaStock).toBe(false)
    expect(articulo.valorEstandar.toString()).toBe('1250.5')
  })

  it('CA2: rechaza un Servicio con costeo Promedio Ponderado', async () => {
    const unidad = await crearUnidad()

    await expect(crearArticulo({
      tipo: 'SERVICIO',
      codigo: 'SER-001',
      descripcion: 'Servicio de prueba',
      unidadId: unidad.id,
      tipoCosteo: 'PROMEDIO_PONDERADO',
    })).rejects.toMatchObject({ statusCode: 422 })
  })

  it('fuerza controlaStock=true para costeo Promedio Ponderado', async () => {
    const unidad = await crearUnidad()

    const articulo = await crearArticulo({
      tipo: 'MATERIAL_EMBALAJE',
      codigo: 'MAT-001',
      descripcion: 'Material de prueba',
      unidadId: unidad.id,
      tipoCosteo: 'PROMEDIO_PONDERADO',
      stockCritico: 10,
    })

    expect(articulo.controlaStock).toBe(true)
  })

  it('mantiene el código inmutable y valida R3/R4 al editar', async () => {
    const unidad = await crearUnidad()
    const articulo = await crearArticulo({
      tipo: 'MATERIAL_EMBALAJE',
      codigo: 'MAT-001',
      descripcion: 'Material de prueba',
      unidadId: unidad.id,
      tipoCosteo: 'PROMEDIO_PONDERADO',
    })

    const actualizado = await actualizarArticulo(articulo.id, {
      tipoCosteo: 'ESTANDAR',
      valorEstandar: 99,
    })
    expect(actualizado.codigo).toBe('MAT-001')
    expect(actualizado.controlaStock).toBe(false)

    await expect(actualizarArticulo(articulo.id, {
      tipo: 'SERVICIO',
      tipoCosteo: 'PROMEDIO_PONDERADO',
    })).rejects.toMatchObject({ statusCode: 422 })

    const almacenado = await obtenerArticulo(articulo.id)
    expect(almacenado.tipo).toBe('MATERIAL_EMBALAJE')
  })

  it('ART-01/ART-02: acepta descripción extranjera null e interpreta activo=false', () => {
    const payload = articuloCreateSchema.parse({
      tipo: 'ENVASE',
      codigo: 'ENV-001',
      descripcion: 'Envase',
      descripcionExtranjera: null,
      unidadId: 1,
      tipoCosteo: 'ESTANDAR',
      valorEstandar: 10,
    })
    const filtros = articuloListQuerySchema.parse({ activo: 'false' })

    expect(payload.descripcionExtranjera).toBeNull()
    expect(filtros.activo).toBe(false)
  })

  it('ART-04: rechaza unidades bloqueadas o eliminadas', async () => {
    const bloqueada = await prisma.unidadMedida.create({
      data: {
        codigo: 'BLQ',
        descripcion: 'Bloqueada',
        bloqueado: true,
        creadoPor: 'test',
      },
    })
    const eliminada = await prisma.unidadMedida.create({
      data: {
        codigo: 'DEL',
        descripcion: 'Eliminada',
        eliminadoEn: new Date(),
        eliminadoPor: 'test',
        creadoPor: 'test',
      },
    })

    for (const unidadId of [bloqueada.id, eliminada.id]) {
      await expect(crearArticulo({
        tipo: 'ENVASE',
        codigo: `ENV-${unidadId}`,
        descripcion: 'Envase inválido',
        unidadId,
        tipoCosteo: 'ESTANDAR',
        valorEstandar: 10,
      })).rejects.toMatchObject({ statusCode: 422 })
    }
  })
})
