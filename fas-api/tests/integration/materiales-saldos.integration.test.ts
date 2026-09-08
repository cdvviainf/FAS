import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma.js'
import { empresaContext } from '../../src/lib/empresa-context.js'
import {
  crearMovimiento as crearMovimientoSvc,
  actualizarMovimiento as actualizarMovimientoSvc,
  agregarLinea as agregarLineaMovSvc,
  confirmarMovimiento as confirmarMovimientoSvc,
  listarSaldos as listarSaldosSvc,
} from '../../src/modules/materiales/movimientos/movimientos.service.js'
import type { MovimientoUpdateInput } from '../../src/modules/materiales/movimientos/movimientos.types.js'

// Reporte "Stock de Materiales" (2026-09-08) — GET /materiales/saldos ya
// existía sin consumidor ni test; se conectó a una pantalla nueva
// (fas-web/features/reportes/saldos-materiales). Estas pruebas fijan: (a)
// Decimal -> number en la respuesta (mismo criterio que kardex.service.ts,
// no la convención global de string decimal — ver movimientos.service.ts),
// (b) que trae la Unidad de Medida (necesaria para mostrar la cantidad), y
// (c) que los filtros bodegaId/tipo/bajoCritico siguen funcionando.

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
async function listarSaldos(empresaId: number, filters: { bodegaId?: number; tipo?: string; bajoCritico?: boolean } = {}) {
  return empresaContext.run({ empresaId }, () => listarSaldosSvc(filters))
}

const databaseName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1)
if (databaseName !== 'fas_test') {
  throw new Error(`Seguridad: las pruebas de integración requieren fas_test; recibido "${databaseName}"`)
}

async function limpiarDatos() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "movimiento_detalles",
      "movimientos",
      "saldos_articulo",
      "tipos_movimiento",
      "articulos",
      "unidades_medida",
      "bodegas",
      "comunas",
      "provincias",
      "regiones"
    RESTART IDENTITY CASCADE
  `)
}

async function obtenerEmpresaTest() {
  const existente = await prisma.empresa.findFirst({ where: { codigo: 'EMP-TEST-SALDOS' } })
  if (existente) return existente
  return prisma.empresa.create({ data: { codigo: 'EMP-TEST-SALDOS', razonSocial: 'Empresa de prueba (saldos)', creadoPor: 'test' } })
}

async function crearFixtures() {
  const empresa = await obtenerEmpresaTest()
  const unidad = await prisma.unidadMedida.create({ data: { empresaId: empresa.id, codigo: 'KG', descripcion: 'Kilogramo', creadoPor: 'test' } })
  const region = await prisma.region.create({ data: { codigo: 'RM', descripcion: 'Metropolitana', creadoPor: 'test' } })
  const provincia = await prisma.provincia.create({ data: { codigo: 'STGO', descripcion: 'Santiago', regionId: region.id, creadoPor: 'test' } })
  const comuna = await prisma.comuna.create({ data: { codigo: 'PROV', descripcion: 'Providencia', provinciaId: provincia.id, creadoPor: 'test' } })
  const bodegaA = await prisma.bodega.create({
    data: { empresaId: empresa.id, codigo: 'BOD-A', descripcion: 'Bodega A', direccion: 'Dirección de prueba', comunaId: comuna.id, creadoPor: 'test' },
  })
  const bodegaB = await prisma.bodega.create({
    data: { empresaId: empresa.id, codigo: 'BOD-B', descripcion: 'Bodega B', direccion: 'Dirección de prueba', comunaId: comuna.id, creadoPor: 'test' },
  })
  // stockCritico=100 > lo que se recibe (20) -> queda bajo crítico a propósito.
  const articuloCritico = await prisma.articulo.create({
    data: { empresaId: empresa.id, tipo: 'MATERIAL_EMBALAJE', codigo: 'ART-CRIT', descripcion: 'Artículo bajo crítico', unidadId: unidad.id, tipoCosteo: 'PROMEDIO_PONDERADO', controlaStock: true, stockCritico: 100, activo: true },
  })
  const articuloEmbalaje = await prisma.articulo.create({
    data: { empresaId: empresa.id, tipo: 'EMBALAJE', codigo: 'ART-EMB', descripcion: 'Artículo embalaje', unidadId: unidad.id, tipoCosteo: 'PROMEDIO_PONDERADO', controlaStock: true, activo: true },
  })
  // entidadRelacionada: null -> confirmarMovimiento no exige entidad ni OC
  // vinculada (R12); irrelevante para lo que este archivo prueba.
  const tipoEntrada = await prisma.tipoMovimiento.create({
    data: { empresaId: empresa.id, codigo: 'ENT', descripcion: 'Entrada', modulos: ['MATERIALES'], clase: 'ENTRADA', requierePrecio: false, activo: true },
  })

  return { empresa, unidad, bodegaA, bodegaB, articuloCritico, articuloEmbalaje, tipoEntrada }
}

async function recibir(f: Awaited<ReturnType<typeof crearFixtures>>, articuloId: number, bodegaId: number, cantidad: number) {
  const mov = await crearMovimiento(f.empresa.id, f.tipoEntrada.id, '2026-01-01', 'test')
  await actualizarMovimiento(f.empresa.id, mov.id, { bodegaDestinoId: bodegaId })
  await agregarLineaMov(f.empresa.id, mov.id, articuloId, cantidad)
  await confirmarMovimiento(f.empresa.id, mov.id, 'test')
}

describe('Reporte Stock de Materiales (GET /materiales/saldos) contra PostgreSQL', () => {
  beforeEach(limpiarDatos)
  afterAll(async () => {
    await limpiarDatos()
    await prisma.$disconnect()
  })

  it('devuelve cantidad/costoPromedio/stockCritico como number (no Decimal) e incluye la Unidad de Medida', async () => {
    const f = await crearFixtures()
    await recibir(f, f.articuloCritico.id, f.bodegaA.id, 20)

    const saldos = await listarSaldos(f.empresa.id)
    const fila = saldos.find((s) => s.articuloId === f.articuloCritico.id)!

    expect(typeof fila.cantidad).toBe('number')
    expect(typeof fila.costoPromedio).toBe('number')
    expect(fila.cantidad).toBe(20)
    expect(typeof fila.articulo.stockCritico).toBe('number')
    expect(fila.articulo.unidad).toMatchObject({ codigo: 'KG' })
  })

  it('filtra por bodegaId y por tipo de artículo', async () => {
    const f = await crearFixtures()
    await recibir(f, f.articuloCritico.id, f.bodegaA.id, 20)
    await recibir(f, f.articuloEmbalaje.id, f.bodegaB.id, 50)

    const soloBodegaA = await listarSaldos(f.empresa.id, { bodegaId: f.bodegaA.id })
    expect(soloBodegaA.map((s) => s.articuloId)).toEqual([f.articuloCritico.id])

    const soloEmbalaje = await listarSaldos(f.empresa.id, { tipo: 'EMBALAJE' })
    expect(soloEmbalaje.map((s) => s.articuloId)).toEqual([f.articuloEmbalaje.id])
  })

  it('filtra bajoCritico=true solo con artículos cuya cantidad quedó por debajo de su stockCritico', async () => {
    const f = await crearFixtures()
    await recibir(f, f.articuloCritico.id, f.bodegaA.id, 20) // stockCritico=100 -> bajo crítico
    await recibir(f, f.articuloEmbalaje.id, f.bodegaB.id, 50) // sin stockCritico -> nunca bajo crítico

    const bajoCritico = await listarSaldos(f.empresa.id, { bajoCritico: true })
    expect(bajoCritico.map((s) => s.articuloId)).toEqual([f.articuloCritico.id])
  })
})
