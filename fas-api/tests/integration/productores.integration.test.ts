import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma.js'
import { crearContacto } from '../../src/modules/config/entidades/entidades.service.js'
import {
  crearPredio,
  eliminarPredio,
} from '../../src/modules/productores/predios/predios.service.js'
import {
  crearContrato,
  subirPdf,
} from '../../src/modules/productores/contratos/contratos.service.js'
import {
  imputarMovimiento,
  obtenerInforme,
} from '../../src/modules/productores/cuenta-corriente/cuenta-corriente.service.js'

const databaseName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1)
if (databaseName !== 'fas_test') {
  throw new Error(`Seguridad: las pruebas de Productores requieren fas_test; recibido "${databaseName}"`)
}

async function limpiarDatos() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "productor_contratos_pdf",
      "productor_contratos",
      "movimientos_cuenta_corriente",
      "predios",
      "entidad_contactos",
      "entidad_direcciones",
      "entidades",
      "conceptos_cta_cte",
      "paises"
    RESTART IDENTITY CASCADE
  `)
}

async function crearEntidad(tipos: ('PRODUCTOR' | 'PROVEEDOR')[], codigo: string) {
  const pais = await prisma.pais.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      codigo: 'CHL',
      descripcion: 'Chile',
      creadoPor: 'test',
    },
  })
  return prisma.entidad.create({
    data: {
      codigo,
      descripcion: `Entidad ${codigo}`,
      razonSocial: `Entidad ${codigo} SpA`,
      paisId: pais.id,
      tipos,
      creadoPor: 'test',
    },
  })
}

describe('maestro de Productores contra PostgreSQL', () => {
  beforeEach(limpiarDatos)
  afterAll(async () => {
    await limpiarDatos()
    await prisma.$disconnect()
  })

  it('CA1: rechaza crear un predio para una entidad que no es Productor', async () => {
    const proveedor = await crearEntidad(['PROVEEDOR'], 'PROV-01')

    await expect(crearPredio(proveedor.id, {
      codigo: 'P-01',
      descripcion: 'Predio inválido',
    }, 'test')).rejects.toMatchObject({ statusCode: 422 })
  })

  it('CA2: exige código de predio único por productor y permite reutilizarlo tras soft delete', async () => {
    const productor = await crearEntidad(['PRODUCTOR'], 'PROD-01')
    const primero = await crearPredio(productor.id, {
      codigo: 'P-01',
      descripcion: 'Predio uno',
    }, 'test')

    await expect(crearPredio(productor.id, {
      codigo: 'P-01',
      descripcion: 'Predio duplicado',
    }, 'test')).rejects.toMatchObject({ statusCode: 422 })

    await eliminarPredio(productor.id, primero.id, 'test')
    const reemplazo = await crearPredio(productor.id, {
      codigo: 'P-01',
      descripcion: 'Predio reemplazo',
    }, 'test')
    expect(reemplazo.id).not.toBe(primero.id)
  })

  it('CA2: permite el mismo código de predio en productores diferentes', async () => {
    const productorA = await crearEntidad(['PRODUCTOR'], 'PROD-A')
    const productorB = await crearEntidad(['PRODUCTOR'], 'PROD-B')

    const [predioA, predioB] = await Promise.all([
      crearPredio(productorA.id, { codigo: 'CENTRAL', descripcion: 'Predio A' }, 'test'),
      crearPredio(productorB.id, { codigo: 'CENTRAL', descripcion: 'Predio B' }, 'test'),
    ])

    expect(predioA.entidadId).not.toBe(predioB.entidadId)
  })

  it('CA3/R3: rechaza representante legal sin RUT y contrato sin representante', async () => {
    const productor = await crearEntidad(['PRODUCTOR'], 'PROD-01')

    await expect(crearContacto(productor.id, {
      codigo: 'LEGAL',
      nombre: 'Representante',
      esRepresentanteLegal: true,
    }, 'test')).rejects.toMatchObject({ statusCode: 422 })

    await expect(crearContrato(productor.id, {}, 'test')).rejects.toMatchObject({
      statusCode: 422,
    })
  })

  it('CA4: crea contrato con condiciones y permite asociar un PDF', async () => {
    const productor = await crearEntidad(['PRODUCTOR'], 'PROD-01')
    await crearContacto(productor.id, {
      codigo: 'LEGAL',
      nombre: 'Representante',
      rut: '12.345.678-5',
      esRepresentanteLegal: true,
    }, 'test')

    const contrato = await crearContrato(productor.id, {
      volumenComprometido: 10_000,
      unidadVolumen: 'KG',
      condicionesPago: 'Pago a 30 días',
    }, 'test')
    const conPdf = await subirPdf(productor.id, contrato.id, {
      nombre: 'contrato.pdf',
      mime: 'application/pdf',
      datos: Buffer.from('%PDF-1.4 prueba'),
    })

    expect(conPdf.volumenComprometido?.toString()).toBe('10000')
    expect(conPdf.unidadVolumen).toBe('KG')
    expect(conPdf.pdfNombre).toBe('contrato.pdf')
  })

  it('CA5/CA6: calcula saldo y valida la naturaleza del concepto', async () => {
    const productor = await crearEntidad(['PRODUCTOR'], 'PROD-01')
    const haber = await prisma.conceptoCtaCte.create({
      data: {
        codigo: 'ANTICIPO',
        descripcion: 'Anticipo',
        naturaleza: 'HABER',
        creadoPor: 'test',
      },
    })
    const ambos = await prisma.conceptoCtaCte.create({
      data: {
        codigo: 'AJUSTE',
        descripcion: 'Ajuste',
        naturaleza: 'AMBOS',
        creadoPor: 'test',
      },
    })

    await imputarMovimiento(productor.id, {
      tipoId: haber.id,
      naturaleza: 'HABER',
      fecha: '2026-07-23',
      monto: 1_000,
    }, 'test')
    await imputarMovimiento(productor.id, {
      tipoId: ambos.id,
      naturaleza: 'DEBE',
      fecha: '2026-07-23',
      monto: 300,
    }, 'test')

    await expect(imputarMovimiento(productor.id, {
      tipoId: haber.id,
      naturaleza: 'DEBE',
      fecha: '2026-07-23',
      monto: 1,
    }, 'test')).rejects.toMatchObject({ statusCode: 422 })

    const informe = await obtenerInforme(productor.id, {})
    expect(informe.saldo).toBe(700)
    expect(informe.movimientos).toHaveLength(2)
  })
})
