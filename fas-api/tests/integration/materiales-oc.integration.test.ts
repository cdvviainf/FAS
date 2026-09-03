import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma.js'
import { empresaContext } from '../../src/lib/empresa-context.js'
import {
  crearOrdenCompraMaterial as crearOrdenCompraMaterialSvc,
  actualizarOrdenCompraMaterial as actualizarOrdenCompraMaterialSvc,
  emitirOrdenCompraMaterial as emitirOrdenCompraMaterialSvc,
  eliminarOrdenCompraMaterial as eliminarOrdenCompraMaterialSvc,
  obtenerOrdenCompraMaterial as obtenerOrdenCompraMaterialSvc,
  agregarLinea as agregarLineaOcSvc,
  actualizarLinea as actualizarLineaOcSvc,
} from '../../src/modules/materiales/ordenes-compra/ordenes-compra.service.js'
import {
  crearMovimiento as crearMovimientoSvc,
  actualizarMovimiento as actualizarMovimientoSvc,
  agregarLinea as agregarLineaMovSvc,
  confirmarMovimiento as confirmarMovimientoSvc,
  eliminarMovimiento as eliminarMovimientoSvc,
} from '../../src/modules/materiales/movimientos/movimientos.service.js'
import type {
  OrdenCompraMaterialCreateInput,
  OrdenCompraMaterialUpdateInput,
  OrdenCompraMaterialLineaCreateInput,
} from '../../src/modules/materiales/ordenes-compra/ordenes-compra.types.js'
import type { MovimientoUpdateInput } from '../../src/modules/materiales/movimientos/movimientos.types.js'

// Orden de Compra de Materiales (materiales.md §4.9, R19-R23) — ronda QA 1
// (Codex, alcance "revisa la creacion de la OC"): CA20-CA28 son los del
// spec original; CA29/CA30 cubren OCM-QA-003 y OCM-QA-002.

async function crearOrdenCompraMaterial(empresaId: number, body: OrdenCompraMaterialCreateInput, userId: string) {
  return empresaContext.run({ empresaId }, () => crearOrdenCompraMaterialSvc(body, userId))
}
async function actualizarOrdenCompraMaterial(empresaId: number, id: number, body: OrdenCompraMaterialUpdateInput, userId: string) {
  return empresaContext.run({ empresaId }, () => actualizarOrdenCompraMaterialSvc(id, body, userId))
}
async function emitirOrdenCompraMaterial(empresaId: number, id: number) {
  return empresaContext.run({ empresaId }, () => emitirOrdenCompraMaterialSvc(id))
}
async function eliminarOrdenCompraMaterial(empresaId: number, id: number, userId: string) {
  return empresaContext.run({ empresaId }, () => eliminarOrdenCompraMaterialSvc(id, userId))
}
async function obtenerOrdenCompraMaterial(empresaId: number, id: number) {
  return empresaContext.run({ empresaId }, () => obtenerOrdenCompraMaterialSvc(id))
}
async function agregarLineaOc(empresaId: number, ordenCompraMaterialId: number, body: OrdenCompraMaterialLineaCreateInput) {
  return empresaContext.run({ empresaId }, () => agregarLineaOcSvc(ordenCompraMaterialId, body))
}
async function actualizarLineaOc(empresaId: number, ordenCompraMaterialId: number, lineaId: number, body: OrdenCompraMaterialLineaCreateInput) {
  return empresaContext.run({ empresaId }, () => actualizarLineaOcSvc(ordenCompraMaterialId, lineaId, body))
}

async function crearMovimiento(empresaId: number, tipoMovimientoId: number, fechaMovimiento: string, userId: string) {
  return empresaContext.run({ empresaId }, () => crearMovimientoSvc({ tipoMovimientoId, fechaMovimiento }, userId))
}
async function actualizarMovimiento(empresaId: number, id: number, body: MovimientoUpdateInput) {
  return empresaContext.run({ empresaId }, () => actualizarMovimientoSvc(id, body))
}
async function agregarLineaMov(empresaId: number, movimientoId: number, articuloId: number, cantidad: number) {
  return empresaContext.run({ empresaId }, () => agregarLineaMovSvc(movimientoId, { articuloId, cantidad }))
}
async function confirmarMovimiento(empresaId: number, id: number, userId: string) {
  return empresaContext.run({ empresaId }, () => confirmarMovimientoSvc(id, userId))
}
async function eliminarMovimiento(empresaId: number, id: number, userId: string) {
  return empresaContext.run({ empresaId }, () => eliminarMovimientoSvc(id, userId))
}

const databaseName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1)
if (databaseName !== 'fas_test') {
  throw new Error(`Seguridad: las pruebas de OC de Materiales requieren fas_test; recibido "${databaseName}"`)
}

async function limpiarDatos() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "orden_compra_material_linea",
      "orden_compra_material_cuota_pago",
      "ordenes_compra_material",
      "movimiento_detalles",
      "movimientos",
      "saldos_articulo",
      "tipos_movimiento",
      "articulos",
      "unidades_medida",
      "bodegas",
      "condicion_pago_cuota",
      "condiciones_pago",
      "entidades",
      "monedas",
      "comunas",
      "provincias",
      "regiones",
      "paises"
    RESTART IDENTITY CASCADE
  `)
}

async function obtenerEmpresaTest() {
  const existente = await prisma.empresa.findFirst({ where: { codigo: 'EMP-TEST' } })
  if (existente) return existente
  return prisma.empresa.create({ data: { codigo: 'EMP-TEST', razonSocial: 'Empresa de prueba', creadoPor: 'test' } })
}

async function crearFixtures() {
  const empresa = await obtenerEmpresaTest()
  const pais = await prisma.pais.create({ data: { codigo: 'CHL', descripcion: 'Chile', creadoPor: 'test' } })
  const proveedor = await prisma.entidad.create({
    data: { empresaId: empresa.id, codigo: 'PROV-01', descripcion: 'Proveedor Uno', razonSocial: 'Proveedor Uno SpA', paisId: pais.id, tipos: ['PROVEEDOR'], creadoPor: 'test' },
  })
  const productor = await prisma.entidad.create({
    data: { empresaId: empresa.id, codigo: 'PROD-01', descripcion: 'Productor Uno', razonSocial: 'Productor Uno SpA', paisId: pais.id, tipos: ['PRODUCTOR'], creadoPor: 'test' },
  })
  const moneda = await prisma.moneda.create({ data: { codigo: 'USD', descripcion: 'Dólar', creadoPor: 'test' } })
  const unidad = await prisma.unidadMedida.create({ data: { empresaId: empresa.id, codigo: 'UN', descripcion: 'Unidad', creadoPor: 'test' } })
  const bodega = await (async () => {
    const region = await prisma.region.create({ data: { codigo: 'RM', descripcion: 'Metropolitana', creadoPor: 'test' } })
    const provincia = await prisma.provincia.create({ data: { codigo: 'STGO', descripcion: 'Santiago', regionId: region.id, creadoPor: 'test' } })
    const comuna = await prisma.comuna.create({ data: { codigo: 'PROV', descripcion: 'Providencia', provinciaId: provincia.id, creadoPor: 'test' } })
    return prisma.bodega.create({
      data: { empresaId: empresa.id, codigo: 'BOD-A', descripcion: 'Bodega A', direccion: 'Dirección de prueba', comunaId: comuna.id, creadoPor: 'test' },
    })
  })()
  const articuloA = await prisma.articulo.create({
    data: { empresaId: empresa.id, tipo: 'MATERIAL_EMBALAJE', codigo: 'ART-A', descripcion: 'Artículo A', unidadId: unidad.id, tipoCosteo: 'PROMEDIO_PONDERADO', controlaStock: true, activo: true },
  })
  const articuloB = await prisma.articulo.create({
    data: { empresaId: empresa.id, tipo: 'MATERIAL_EMBALAJE', codigo: 'ART-B', descripcion: 'Artículo B', unidadId: unidad.id, tipoCosteo: 'PROMEDIO_PONDERADO', controlaStock: true, activo: true },
  })
  const tipoEntrada = await prisma.tipoMovimiento.create({
    data: { empresaId: empresa.id, codigo: 'ENT', descripcion: 'Entrada', modulos: ['MATERIALES'], clase: 'ENTRADA', requierePrecio: false, entidadRelacionada: 'PROVEEDOR', activo: true },
  })
  const condicionPagoPorcentaje = await prisma.condicionPago.create({
    data: {
      empresaId: empresa.id, codigo: 'CP-30-70', descripcion: '30/70', tipo: 'COMPRA', creadoPor: 'test',
      cuotas: { create: [{ plazoDias: 30, tipoValor: 'PORCENTAJE', porcentaje: 30 }, { plazoDias: 60, tipoValor: 'PORCENTAJE', porcentaje: 70 }] },
    },
    include: { cuotas: true },
  })
  const condicionPagoMontoUnitario = await prisma.condicionPago.create({
    data: {
      empresaId: empresa.id, codigo: 'CP-UNIT', descripcion: 'Cargo por caja', tipo: 'COMPRA', creadoPor: 'test',
      cuotas: { create: [{ plazoDias: 0, tipoValor: 'MONTO_UNITARIO', valorUnitario: 1, monedaId: moneda.id, unidadId: unidad.id }] },
    },
    include: { cuotas: true },
  })

  return { empresa, pais, proveedor, productor, moneda, unidad, bodega, articuloA, articuloB, tipoEntrada, condicionPagoPorcentaje, condicionPagoMontoUnitario }
}

async function crearOcConLinea(f: Awaited<ReturnType<typeof crearFixtures>>, cantidad = 10) {
  const oc = await crearOrdenCompraMaterial(f.empresa.id, { entidadProveedorId: f.proveedor.id, monedaId: f.moneda.id }, 'test')
  await agregarLineaOc(f.empresa.id, oc.id, { articuloId: f.articuloA.id, cantidad, precioUnitario: 5 })
  return obtenerOrdenCompraMaterial(f.empresa.id, oc.id)
}

describe('Orden de Compra de Materiales contra PostgreSQL', () => {
  beforeEach(limpiarDatos)
  afterAll(async () => {
    await limpiarDatos()
    await prisma.$disconnect()
  })

  it('CA20 (R19): rechaza un proveedor sin tipo PROVEEDOR', async () => {
    const f = await crearFixtures()
    await expect(
      crearOrdenCompraMaterial(f.empresa.id, { entidadProveedorId: f.productor.id, monedaId: f.moneda.id }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('CA21 (R20): OC EMITIDA bloquea edición de cabecera y de línea', async () => {
    const f = await crearFixtures()
    const oc = await crearOcConLinea(f)
    await emitirOrdenCompraMaterial(f.empresa.id, oc.id)

    await expect(
      actualizarOrdenCompraMaterial(f.empresa.id, oc.id, { observaciones: 'cambio' }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })
    await expect(
      actualizarLineaOc(f.empresa.id, oc.id, oc.lineas[0].id, { articuloId: f.articuloA.id, cantidad: 99, precioUnitario: 5 }),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('CA22 (R21): rechaza una condición de pago con cuota MONTO_UNITARIO', async () => {
    const f = await crearFixtures()
    await expect(
      crearOrdenCompraMaterial(
        f.empresa.id,
        { entidadProveedorId: f.proveedor.id, monedaId: f.moneda.id, condicionPagoId: f.condicionPagoMontoUnitario.id },
        'test',
      ),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('CA23 (R21): condición 100% PORCENTAJE crea el snapshot de cuotas', async () => {
    const f = await crearFixtures()
    const oc = await crearOrdenCompraMaterial(
      f.empresa.id,
      { entidadProveedorId: f.proveedor.id, monedaId: f.moneda.id, condicionPagoId: f.condicionPagoPorcentaje.id },
      'test',
    )
    const detalle = await obtenerOrdenCompraMaterial(f.empresa.id, oc.id)
    expect(detalle.cuotasPago).toHaveLength(2)
    expect(detalle.cuotasPago.map((c) => Number(c.porcentaje)).sort()).toEqual([30, 70])
  })

  it('CA24 (R22-articulo): rechaza confirmar un Movimiento con un artículo que no está en la OC', async () => {
    const f = await crearFixtures()
    const oc = await crearOcConLinea(f, 10)
    await emitirOrdenCompraMaterial(f.empresa.id, oc.id)

    const mov = await crearMovimiento(f.empresa.id, f.tipoEntrada.id, '2026-01-01', 'test')
    await actualizarMovimiento(f.empresa.id, mov.id, { bodegaDestinoId: f.bodega.id, ordenCompraMaterialId: oc.id })
    await agregarLineaMov(f.empresa.id, mov.id, f.articuloB.id, 5) // B no está en la OC

    await expect(confirmarMovimiento(f.empresa.id, mov.id, 'test')).rejects.toMatchObject({ statusCode: 422 })
  })

  it('CA25 (R22-cantidad): rechaza confirmar un Movimiento con cantidad mayor a la de la OC', async () => {
    const f = await crearFixtures()
    const oc = await crearOcConLinea(f, 10)
    await emitirOrdenCompraMaterial(f.empresa.id, oc.id)

    const mov = await crearMovimiento(f.empresa.id, f.tipoEntrada.id, '2026-01-01', 'test')
    await actualizarMovimiento(f.empresa.id, mov.id, { bodegaDestinoId: f.bodega.id, ordenCompraMaterialId: oc.id })
    await agregarLineaMov(f.empresa.id, mov.id, f.articuloA.id, 15) // OC tiene 10

    await expect(confirmarMovimiento(f.empresa.id, mov.id, 'test')).rejects.toMatchObject({ statusCode: 422 })
  })

  it('CA26 (R22-cierre): confirma el Movimiento y cierra la OC como RECEPCIONADA', async () => {
    const f = await crearFixtures()
    const oc = await crearOcConLinea(f, 10)
    await emitirOrdenCompraMaterial(f.empresa.id, oc.id)

    const mov = await crearMovimiento(f.empresa.id, f.tipoEntrada.id, '2026-01-01', 'test')
    await actualizarMovimiento(f.empresa.id, mov.id, { bodegaDestinoId: f.bodega.id, ordenCompraMaterialId: oc.id })
    await agregarLineaMov(f.empresa.id, mov.id, f.articuloA.id, 10)

    const confirmado = await confirmarMovimiento(f.empresa.id, mov.id, 'test')
    expect(confirmado.estado).toBe('CONFIRMADO')
    // entidadId debe copiarse server-side desde la OC (no vino informado)
    expect(confirmado.entidadId).toBe(f.proveedor.id)

    const ocFinal = await obtenerOrdenCompraMaterial(f.empresa.id, oc.id)
    expect(ocFinal.estado).toBe('RECEPCIONADA')
  })

  it('CA27 (R22-único): rechaza vincular un segundo Movimiento activo a la misma OC', async () => {
    const f = await crearFixtures()
    const oc = await crearOcConLinea(f, 10)
    await emitirOrdenCompraMaterial(f.empresa.id, oc.id)

    const mov1 = await crearMovimiento(f.empresa.id, f.tipoEntrada.id, '2026-01-01', 'test')
    await actualizarMovimiento(f.empresa.id, mov1.id, { bodegaDestinoId: f.bodega.id, ordenCompraMaterialId: oc.id })

    const mov2 = await crearMovimiento(f.empresa.id, f.tipoEntrada.id, '2026-01-01', 'test')
    await expect(
      actualizarMovimiento(f.empresa.id, mov2.id, { bodegaDestinoId: f.bodega.id, ordenCompraMaterialId: oc.id }),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('CA28 (R22-borrador): eliminar el Movimiento BORRADOR libera la OC para uno nuevo', async () => {
    const f = await crearFixtures()
    const oc = await crearOcConLinea(f, 10)
    await emitirOrdenCompraMaterial(f.empresa.id, oc.id)

    const mov1 = await crearMovimiento(f.empresa.id, f.tipoEntrada.id, '2026-01-01', 'test')
    await actualizarMovimiento(f.empresa.id, mov1.id, { bodegaDestinoId: f.bodega.id, ordenCompraMaterialId: oc.id })
    await eliminarMovimiento(f.empresa.id, mov1.id, 'test')

    const mov2 = await crearMovimiento(f.empresa.id, f.tipoEntrada.id, '2026-01-01', 'test')
    await expect(
      actualizarMovimiento(f.empresa.id, mov2.id, { bodegaDestinoId: f.bodega.id, ordenCompraMaterialId: oc.id }),
    ).resolves.toMatchObject({ ordenCompraMaterialId: oc.id })
  })

  it('CA29 (R22-completo, OCM-QA-003): rechaza confirmar un Movimiento que omite un artículo de la OC', async () => {
    const f = await crearFixtures()
    const oc = await crearOrdenCompraMaterial(f.empresa.id, { entidadProveedorId: f.proveedor.id, monedaId: f.moneda.id }, 'test')
    await agregarLineaOc(f.empresa.id, oc.id, { articuloId: f.articuloA.id, cantidad: 10, precioUnitario: 5 })
    await agregarLineaOc(f.empresa.id, oc.id, { articuloId: f.articuloB.id, cantidad: 4, precioUnitario: 2 })
    await emitirOrdenCompraMaterial(f.empresa.id, oc.id)

    const mov = await crearMovimiento(f.empresa.id, f.tipoEntrada.id, '2026-01-01', 'test')
    await actualizarMovimiento(f.empresa.id, mov.id, { bodegaDestinoId: f.bodega.id, ordenCompraMaterialId: oc.id })
    await agregarLineaMov(f.empresa.id, mov.id, f.articuloA.id, 10) // falta articuloB

    await expect(confirmarMovimiento(f.empresa.id, mov.id, 'test')).rejects.toMatchObject({ statusCode: 422 })

    const ocFinal = await obtenerOrdenCompraMaterial(f.empresa.id, oc.id)
    expect(ocFinal.estado).toBe('EMITIDA')
  })

  it('CA30 (R20-eliminación, OCM-QA-002): elimina una OC EMITIDA sin Movimiento; rechaza si tiene uno activo', async () => {
    const f = await crearFixtures()
    const oc1 = await crearOcConLinea(f, 10)
    await emitirOrdenCompraMaterial(f.empresa.id, oc1.id)
    await expect(eliminarOrdenCompraMaterial(f.empresa.id, oc1.id, 'test')).resolves.toBeUndefined()

    const oc2 = await crearOcConLinea(f, 10)
    await emitirOrdenCompraMaterial(f.empresa.id, oc2.id)
    const mov = await crearMovimiento(f.empresa.id, f.tipoEntrada.id, '2026-01-01', 'test')
    await actualizarMovimiento(f.empresa.id, mov.id, { bodegaDestinoId: f.bodega.id, ordenCompraMaterialId: oc2.id })

    await expect(eliminarOrdenCompraMaterial(f.empresa.id, oc2.id, 'test')).rejects.toMatchObject({ statusCode: 422 })
  })
})
