import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma.js'
import { empresaContext } from '../../src/lib/empresa-context.js'
import { crearRecepcion as crearRecepcionSvc } from '../../src/modules/compras/recepciones/recepciones.service.js'
import { obtenerResumenStock, obtenerDetalleStock } from '../../src/modules/operaciones/stock/stock.service.js'
import type { RecepcionCreateInput } from '../../src/modules/compras/recepciones/recepciones.types.js'
import type { StockFiltros } from '../../src/modules/operaciones/stock/stock.types.js'

// Mismo patrón que ventas-compras.integration.test.ts / recepciones.integration.test.ts:
// crearRecepcion usa prisma.$transaction() internamente y pierde el contexto
// ALS si solo se establece con enterWith en beforeEach.
async function crearRecepcion(empresaId: number, body: RecepcionCreateInput, userId: string) {
  return empresaContext.run({ empresaId }, () => crearRecepcionSvc(body, userId))
}
async function resumen(empresaId: number, filtros: StockFiltros) {
  return empresaContext.run({ empresaId }, () => obtenerResumenStock(filtros))
}
async function detalle(empresaId: number, filtros: StockFiltros) {
  return empresaContext.run({ empresaId }, () => obtenerDetalleStock(filtros))
}

const databaseName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1)
if (databaseName !== 'fas_test') {
  throw new Error(`Seguridad: las pruebas de Stock requieren fas_test; recibido "${databaseName}"`)
}

async function limpiarDatos() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "pallet_lineas",
      "pallets",
      "recepciones",
      "articulos",
      "calibres",
      "categorias",
      "variedades",
      "grupos_variedad",
      "especies",
      "entidad_direcciones",
      "entidades",
      "paises"
    RESTART IDENTITY CASCADE
  `)
}

async function obtenerEmpresaTest() {
  const existente = await prisma.empresa.findFirst({ where: { codigo: 'EMP-TEST' } })
  if (existente) return existente
  return prisma.empresa.create({ data: { codigo: 'EMP-TEST', razonSocial: 'Empresa de prueba', creadoPor: 'test' } })
}

async function entrarContextoEmpresa() {
  const empresa = await obtenerEmpresaTest()
  empresaContext.enterWith({ empresaId: empresa.id })
}

async function crearFixtures() {
  const empresa = await obtenerEmpresaTest()
  const pais = await prisma.pais.create({ data: { codigo: 'CHL', descripcion: 'Chile', creadoPor: 'test' } })
  const productor = await prisma.entidad.create({
    data: { empresaId: empresa.id, codigo: 'PROD-01', descripcion: 'Productor Uno', razonSocial: 'Productor Uno SpA', paisId: pais.id, tipos: ['PRODUCTOR'], creadoPor: 'test' },
  })
  const otroProductor = await prisma.entidad.create({
    data: { empresaId: empresa.id, codigo: 'PROD-02', descripcion: 'Productor Dos', razonSocial: 'Productor Dos SpA', paisId: pais.id, tipos: ['PRODUCTOR'], creadoPor: 'test' },
  })
  const planta = await prisma.entidad.create({
    data: { empresaId: empresa.id, codigo: 'PLANTA-01', descripcion: 'Planta Uno', razonSocial: 'Planta Uno SpA', paisId: pais.id, tipos: ['PLANTA'], creadoPor: 'test' },
  })
  const direccionPlanta = await prisma.entidadDireccion.create({
    data: { entidadId: planta.id, codigo: 'DIR-1', descripcion: 'Bodega Central', paisId: pais.id, direccion: 'Camino a la Planta 123', creadoPor: 'test' },
  })
  const especie = await prisma.especie.create({ data: { empresaId: empresa.id, codigo: 'UV', descripcion: 'Uva', creadoPor: 'test' } })
  const grupoVariedad = await prisma.grupoVariedad.create({ data: { empresaId: empresa.id, codigo: 'GV-UV', descripcion: 'Uva de Mesa', especieId: especie.id, creadoPor: 'test' } })
  const variedad = await prisma.variedad.create({ data: { empresaId: empresa.id, codigo: 'RG', descripcion: 'Red Globe', especieId: especie.id, grupoVariedadId: grupoVariedad.id, creadoPor: 'test' } })
  const categoria = await prisma.categoria.create({ data: { empresaId: empresa.id, codigo: 'CAT1', descripcion: 'Categoría 1', especieId: especie.id, orden: 1, control: [], creadoPor: 'test' } })
  const calibreChico = await prisma.calibre.create({ data: { empresaId: empresa.id, codigo: 'XL', descripcion: 'XL', especieId: especie.id, orden: 1, control: [], creadoPor: 'test' } })
  const calibreGrande = await prisma.calibre.create({ data: { empresaId: empresa.id, codigo: 'XXL', descripcion: 'XXL', especieId: especie.id, orden: 2, control: [], creadoPor: 'test' } })
  const unidad = await prisma.unidadMedida.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, empresaId: empresa.id, codigo: 'CAJA', descripcion: 'Caja', creadoPor: 'test' },
  })
  const articulo = await prisma.articulo.create({
    data: { empresaId: empresa.id, tipo: 'EMBALAJE', codigo: 'ART-EMB', descripcion: 'Caja embalaje', unidadId: unidad.id, tipoCosteo: 'PROMEDIO_PONDERADO' },
  })

  const recepcion = await crearRecepcion(empresa.id, { plantaId: planta.id, direccionPlantaId: direccionPlanta.id }, 'test')

  return { empresa, productor, otroProductor, especie, variedad, categoria, calibreChico, calibreGrande, articulo, recepcion }
}

// Crea un Pallet con sus líneas directamente vía Prisma — no pasa por el
// motor de carga de Excel (recepciones.motor.ts), que no es lo que este
// archivo ejercita. El reporte de stock lee Pallet/PalletLinea tal cual
// quedan en la BD sin importar cómo se originaron.
async function crearPallet(
  f: Awaited<ReturnType<typeof crearFixtures>>,
  opts: {
    numeroPallet: string
    productorId?: number
    origen?: 'COMPRA' | 'CONSIGNACION' | 'PROCESO'
    creadoEn?: Date
    lineas: { categoriaId?: number; calibreId?: number; cajas: number }[]
  },
) {
  return prisma.pallet.create({
    data: {
      empresaId: f.empresa.id,
      recepcionId: f.recepcion.id,
      numeroPallet: opts.numeroPallet,
      origen: opts.origen ?? 'CONSIGNACION',
      productorId: opts.productorId ?? f.productor.id,
      creadoEn: opts.creadoEn ?? new Date(),
      lineas: {
        create: opts.lineas.map((l) => ({
          especieId: f.especie.id,
          variedadId: f.variedad.id,
          categoriaId: l.categoriaId ?? f.categoria.id,
          articuloId: f.articulo.id,
          calibreId: l.calibreId ?? f.calibreChico.id,
          cajas: l.cajas,
        })),
      },
    },
  })
}

describe('Reporte de Stock de Fruta contra PostgreSQL', () => {
  beforeEach(limpiarDatos)
  beforeEach(entrarContextoEmpresa)
  afterAll(async () => {
    await limpiarDatos()
    await prisma.$disconnect()
  })

  it('agrupa por especie/variedad/categoría/calibre sumando cajas y contando pallets distintos', async () => {
    const f = await crearFixtures()
    await crearPallet(f, { numeroPallet: 'P-001', lineas: [{ calibreId: f.calibreChico.id, cajas: 100 }] })
    await crearPallet(f, {
      numeroPallet: 'P-002',
      lineas: [
        { calibreId: f.calibreChico.id, cajas: 50 },
        { calibreId: f.calibreGrande.id, cajas: 30 },
      ],
    })

    const grupos = await resumen(f.empresa.id, {})
    expect(grupos).toHaveLength(2)

    const grupoChico = grupos.find((g) => g.calibreId === f.calibreChico.id)!
    expect(grupoChico.cajas).toBe(150)
    expect(grupoChico.pallets).toBe(2)

    const grupoGrande = grupos.find((g) => g.calibreId === f.calibreGrande.id)!
    expect(grupoGrande.cajas).toBe(30)
    expect(grupoGrande.pallets).toBe(1)
  })

  it('filtra por productor', async () => {
    const f = await crearFixtures()
    await crearPallet(f, { numeroPallet: 'P-001', productorId: f.productor.id, lineas: [{ cajas: 100 }] })
    await crearPallet(f, { numeroPallet: 'P-002', productorId: f.otroProductor.id, lineas: [{ cajas: 40 }] })

    const soloProductor1 = await resumen(f.empresa.id, { productorId: f.productor.id })
    expect(soloProductor1).toHaveLength(1)
    expect(soloProductor1[0].cajas).toBe(100)

    const sinFiltro = await resumen(f.empresa.id, {})
    expect(sinFiltro[0].cajas).toBe(140) // misma combinación especie/variedad/categoría/calibre para ambos productores
  })

  it('filtra por origen y por rango de fecha de recepción', async () => {
    const f = await crearFixtures()
    await crearPallet(f, { numeroPallet: 'P-COMPRA', origen: 'COMPRA', creadoEn: new Date('2026-08-01'), lineas: [{ cajas: 10 }] })
    await crearPallet(f, { numeroPallet: 'P-CONSIG', origen: 'CONSIGNACION', creadoEn: new Date('2026-08-15'), lineas: [{ cajas: 20 }] })

    const soloCompra = await resumen(f.empresa.id, { origen: 'COMPRA' })
    expect(soloCompra).toHaveLength(1)
    expect(soloCompra[0].cajas).toBe(10)

    const soloAgosto1a10 = await resumen(f.empresa.id, { fechaDesde: new Date('2026-08-01'), fechaHasta: new Date('2026-08-10') })
    expect(soloAgosto1a10).toHaveLength(1)
    expect(soloAgosto1a10[0].cajas).toBe(10)
  })

  it('el detalle (drill-down) devuelve una fila por pallet con su productor y cajas, no el total del grupo', async () => {
    const f = await crearFixtures()
    await crearPallet(f, { numeroPallet: 'P-001', productorId: f.productor.id, lineas: [{ cajas: 100 }] })
    await crearPallet(f, { numeroPallet: 'P-002', productorId: f.otroProductor.id, lineas: [{ cajas: 50 }] })

    const filas = await detalle(f.empresa.id, {
      especieId: f.especie.id,
      variedadId: f.variedad.id,
      categoriaId: f.categoria.id,
      calibreId: f.calibreChico.id,
    })

    expect(filas).toHaveLength(2)
    const filaP1 = filas.find((r) => r.numeroPallet === 'P-001')!
    expect(filaP1.cajas).toBe(100)
    expect(filaP1.productor.id).toBe(f.productor.id)
    const filaP2 = filas.find((r) => r.numeroPallet === 'P-002')!
    expect(filaP2.cajas).toBe(50)
    expect(filaP2.productor.id).toBe(f.otroProductor.id)
  })

  it('no devuelve nada para filtros que no calzan con ningún pallet', async () => {
    const f = await crearFixtures()
    await crearPallet(f, { numeroPallet: 'P-001', lineas: [{ cajas: 100 }] })

    const vacio = await resumen(f.empresa.id, { calibreId: f.calibreGrande.id })
    expect(vacio).toHaveLength(0)
  })
})
