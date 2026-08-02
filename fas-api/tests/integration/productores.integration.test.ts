import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma.js'
import { empresaContext } from '../../src/lib/empresa-context.js'
import { crearContacto } from '../../src/modules/config/entidades/entidades.service.js'
import {
  crearPredio,
  eliminarPredio,
} from '../../src/modules/productores/predios/predios.service.js'
import {
  crearContrato,
  agregarAdjunto,
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
      "productor_contrato_adjuntos_contenido",
      "productor_contrato_adjuntos",
      "productor_contrato_linea",
      "productor_contratos",
      "movimientos_cuenta_corriente",
      "predios",
      "entidad_contactos",
      "entidad_direcciones",
      "entidades",
      "conceptos_cta_cte",
      "articulos",
      "calibres",
      "categorias",
      "variedades",
      "grupos_variedad",
      "especies",
      "temporadas",
      "unidades_medida",
      "paises",
      "mercados",
      "grupos_mercado"
    RESTART IDENTITY CASCADE
  `)
}

// Mercado/GrupoMercado son por-empresa desde Fase 2a — estas fixtures crean
// filas vía prisma crudo, fuera de cualquier request (sin contexto ALS), así
// que necesitan empresaId explícito. "empresas" no se trunca entre tests (no
// participa del aislamiento que este archivo ejercita).
async function obtenerEmpresaTest() {
  const existente = await prisma.empresa.findFirst({ where: { codigo: 'EMP-TEST' } })
  if (existente) return existente
  return prisma.empresa.create({ data: { codigo: 'EMP-TEST', razonSocial: 'Empresa de prueba', creadoPor: 'test' } })
}

async function crearEntidad(tipos: ('PRODUCTOR' | 'PROVEEDOR')[], codigo: string) {
  const empresa = await obtenerEmpresaTest()
  const grupoMercado = await prisma.grupoMercado.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, empresaId: empresa.id, codigo: 'GM-TEST', descripcion: 'Grupo prueba', creadoPor: 'test' },
  })
  const mercado = await prisma.mercado.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, empresaId: empresa.id, codigo: 'M-TEST', descripcion: 'Mercado prueba', grupoMercadoId: grupoMercado.id, creadoPor: 'test' },
  })
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
  await prisma.mercadoPais.upsert({
    where: { empresaId_paisId: { empresaId: empresa.id, paisId: pais.id } },
    update: { mercadoId: mercado.id },
    create: { empresaId: empresa.id, mercadoId: mercado.id, paisId: pais.id, creadoPor: 'test' },
  })
  return prisma.entidad.create({
    data: {
      empresaId: empresa.id,
      codigo,
      descripcion: `Entidad ${codigo}`,
      razonSocial: `Entidad ${codigo} SpA`,
      paisId: pais.id,
      tipos,
      creadoPor: 'test',
    },
  })
}

async function crearFixturesContrato() {
  const empresa = await obtenerEmpresaTest()
  const temporada = await prisma.temporada.create({
    data: { empresaId: empresa.id, codigo: 'T26', descripcion: 'Temporada 2026', fechaInicio: new Date('2026-01-01'), fechaTermino: new Date('2026-12-31'), creadoPor: 'test' },
  })
  const especie = await prisma.especie.create({ data: { empresaId: empresa.id, codigo: 'UV', descripcion: 'Uva', creadoPor: 'test' } })
  const grupoVariedad = await prisma.grupoVariedad.create({ data: { empresaId: empresa.id, codigo: 'GV-UV', descripcion: 'Uva de Mesa', especieId: especie.id, creadoPor: 'test' } })
  const variedad = await prisma.variedad.create({ data: { empresaId: empresa.id, codigo: 'RG', descripcion: 'Red Globe', especieId: especie.id, grupoVariedadId: grupoVariedad.id, creadoPor: 'test' } })
  const categoria = await prisma.categoria.create({ data: { empresaId: empresa.id, codigo: 'CAT1', descripcion: 'Categoría 1', especieId: especie.id, orden: 1, control: [], creadoPor: 'test' } })
  const calibreDesde = await prisma.calibre.create({ data: { empresaId: empresa.id, codigo: 'XL', descripcion: 'XL', especieId: especie.id, orden: 1, control: [], creadoPor: 'test' } })
  const calibreHasta = await prisma.calibre.create({ data: { empresaId: empresa.id, codigo: 'XXL', descripcion: 'XXL', especieId: especie.id, orden: 2, control: [], creadoPor: 'test' } })
  const unidad = await prisma.unidadMedida.create({ data: { empresaId: empresa.id, codigo: 'KG', descripcion: 'Kilos', creadoPor: 'test' } })
  const articulo = await prisma.articulo.create({
    data: { empresaId: empresa.id, tipo: 'EMBALAJE', codigo: 'ART-EMB', descripcion: 'Caja embalaje', unidadId: unidad.id, tipoCosteo: 'PROMEDIO_PONDERADO' },
  })

  return { empresa, temporada, especie, variedad, categoria, calibreDesde, calibreHasta, unidad, articulo }
}

function lineaBase(f: Awaited<ReturnType<typeof crearFixturesContrato>>) {
  return {
    articuloId: f.articulo.id,
    variedadId: f.variedad.id,
    calibreDesdeId: f.calibreDesde.id,
    calibreHastaId: f.calibreHasta.id,
    categoriaId: f.categoria.id,
    unidadMedidaId: f.unidad.id,
    cantidadComprometida: 10_000,
    minimoGarantizado: 8_000,
  }
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
    const f = await crearFixturesContrato()

    await expect(crearContacto(productor.id, {
      codigo: 'LEGAL',
      nombre: 'Representante',
      esRepresentanteLegal: true,
    }, 'test')).rejects.toMatchObject({ statusCode: 422 })

    // crearContrato valida temporadaId/especieId/variedad/categoria/calibre
    // contra modelos por-empresa desde Fase 3 — necesita contexto ALS (fuera
    // de un request HTTP no existe por defecto).
    await empresaContext.run({ empresaId: f.empresa.id }, async () => {
      await expect(crearContrato(productor.id, {
        temporadaId: f.temporada.id,
        especieId: f.especie.id,
        fechaInicio: '2026-01-01',
        fechaTermino: '2026-12-31',
        lineas: [lineaBase(f)],
      }, 'test')).rejects.toMatchObject({
        statusCode: 422,
      })
    })
  })

  it('CA4: crea contrato con especie/temporada de cabecera, línea de características y permite adjuntar documentos', async () => {
    const productor = await crearEntidad(['PRODUCTOR'], 'PROD-01')
    const f = await crearFixturesContrato()
    await crearContacto(productor.id, {
      codigo: 'LEGAL',
      nombre: 'Representante',
      rut: '12.345.678-5',
      esRepresentanteLegal: true,
    }, 'test')

    const contrato = await empresaContext.run({ empresaId: f.empresa.id }, () =>
      crearContrato(productor.id, {
        temporadaId: f.temporada.id,
        especieId: f.especie.id,
        fechaInicio: '2026-01-01',
        fechaTermino: '2026-12-31',
        lineas: [lineaBase(f)],
      }, 'test'),
    )

    expect(contrato.especieId).toBe(f.especie.id)
    expect(contrato.lineas).toHaveLength(1)
    expect(contrato.lineas[0].cantidadComprometida.toString()).toBe('10000')

    const adjunto = await agregarAdjunto(productor.id, contrato.id, {
      nombre: 'contrato.pdf',
      mime: 'application/pdf',
      datos: Buffer.from('%PDF-1.4 prueba'),
    }, 'test')

    expect(adjunto.nombre).toBe('contrato.pdf')
  })

  it('PROD-CONTRATO: rechaza un segundo contrato para la misma especie y temporada del productor', async () => {
    const productor = await crearEntidad(['PRODUCTOR'], 'PROD-01')
    const f = await crearFixturesContrato()
    await crearContacto(productor.id, {
      codigo: 'LEGAL',
      nombre: 'Representante',
      rut: '12.345.678-5',
      esRepresentanteLegal: true,
    }, 'test')

    const datos = {
      temporadaId: f.temporada.id,
      especieId: f.especie.id,
      fechaInicio: '2026-01-01',
      fechaTermino: '2026-12-31',
      lineas: [lineaBase(f)],
    }
    await empresaContext.run({ empresaId: f.empresa.id }, async () => {
      await crearContrato(productor.id, datos, 'test')
      await expect(crearContrato(productor.id, datos, 'test')).rejects.toMatchObject({ statusCode: 422 })
    })
  })

  it('CA5/CA6: calcula saldo y valida la naturaleza del concepto', async () => {
    const empresa = await obtenerEmpresaTest()
    const productor = await crearEntidad(['PRODUCTOR'], 'PROD-01')
    const haber = await prisma.conceptoCtaCte.create({
      data: {
        empresaId: empresa.id,
        codigo: 'ANTICIPO',
        descripcion: 'Anticipo',
        naturaleza: 'HABER',
        creadoPor: 'test',
      },
    })
    const ambos = await prisma.conceptoCtaCte.create({
      data: {
        empresaId: empresa.id,
        codigo: 'AJUSTE',
        descripcion: 'Ajuste',
        naturaleza: 'AMBOS',
        creadoPor: 'test',
      },
    })

    // ConceptoCtaCte es por-empresa desde Fase 3 — imputarMovimiento valida
    // tipoId contra ese modelo, así que necesita contexto ALS (fuera de un
    // request HTTP no existe por defecto).
    await empresaContext.run({ empresaId: empresa.id }, async () => {
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
    })

    const informe = await obtenerInforme(productor.id, {})
    expect(informe.saldo).toBe(700)
    expect(informe.movimientos).toHaveLength(2)
  })
})
