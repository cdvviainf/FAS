import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma.js'
import { empresaContext } from '../../src/lib/empresa-context.js'
import { obtenerKardex } from '../../src/modules/materiales/kardex/kardex.service.js'

// El Kardex reconstruye el saldo corrido (cantidad + PMP) reproduciendo el
// historial completo de MovimientoDetalle — estas pruebas insertan
// movimientos directamente vía Prisma (sin pasar por movimientos.service,
// que valida reglas de negocio ajenas al cálculo del Kardex en sí) y
// verifican que el replay coincide con el motor transaccional real
// (movimientos.repository.ts, R5/R6).

const databaseName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1)
if (databaseName !== 'fas_test') {
  throw new Error(`Seguridad: las pruebas de Kardex requieren fas_test; recibido "${databaseName}"`)
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
  const existente = await prisma.empresa.findFirst({ where: { codigo: 'EMP-TEST' } })
  if (existente) return existente
  return prisma.empresa.create({ data: { codigo: 'EMP-TEST', razonSocial: 'Empresa de prueba', creadoPor: 'test' } })
}

async function crearComuna() {
  const region = await prisma.region.create({ data: { codigo: 'RM', descripcion: 'Metropolitana', creadoPor: 'test' } })
  const provincia = await prisma.provincia.create({
    data: { codigo: 'STGO', descripcion: 'Santiago', regionId: region.id, creadoPor: 'test' },
  })
  return prisma.comuna.create({ data: { codigo: 'PROV', descripcion: 'Providencia', provinciaId: provincia.id, creadoPor: 'test' } })
}

async function crearBodega(empresaId: number, comunaId: number, codigo: string) {
  return prisma.bodega.create({
    data: { empresaId, codigo, descripcion: `Bodega ${codigo}`, direccion: 'Dirección de prueba', comunaId, creadoPor: 'test' },
  })
}

async function crearUnidad(empresaId: number) {
  return prisma.unidadMedida.create({ data: { empresaId, codigo: 'UN', descripcion: 'Unidad', creadoPor: 'test' } })
}

async function crearArticulo(empresaId: number, unidadId: number, codigo: string) {
  return prisma.articulo.create({
    data: {
      empresaId,
      tipo: 'MATERIAL_EMBALAJE',
      codigo,
      descripcion: `Artículo ${codigo}`,
      unidadId,
      tipoCosteo: 'PROMEDIO_PONDERADO',
      controlaStock: true,
      activo: true,
    },
  })
}

async function crearTipoMovimiento(empresaId: number, codigo: string, clase: 'ENTRADA' | 'SALIDA' | 'TRASLADO') {
  return prisma.tipoMovimiento.create({
    data: { empresaId, codigo, descripcion: codigo, modulos: ['MATERIALES'], clase, requierePrecio: false, activo: true },
  })
}

async function crearMovimiento(params: {
  empresaId: number
  tipoMovimientoId: number
  fechaMovimiento: string
  bodegaOrigenId?: number
  bodegaDestinoId?: number
  articuloId: number
  cantidad: number
  precioUnitario?: number
}) {
  return prisma.movimiento.create({
    data: {
      empresaId: params.empresaId,
      tipoMovimientoId: params.tipoMovimientoId,
      fechaMovimiento: new Date(params.fechaMovimiento),
      bodegaOrigenId: params.bodegaOrigenId ?? null,
      bodegaDestinoId: params.bodegaDestinoId ?? null,
      usuarioId: 'test-user',
      detalle: {
        create: [{ articuloId: params.articuloId, cantidad: params.cantidad, precioUnitario: params.precioUnitario ?? null }],
      },
    },
  })
}

describe('Kardex de Materiales contra PostgreSQL', () => {
  beforeEach(limpiarDatos)
  afterAll(async () => {
    await limpiarDatos()
    await prisma.$disconnect()
  })

  it('reconstruye el saldo corrido consolidado, por bodega y por rango de fechas', async () => {
    const empresa = await obtenerEmpresaTest()
    const comuna = await crearComuna()
    const bodegaA = await crearBodega(empresa.id, comuna.id, 'BOD-A')
    const bodegaB = await crearBodega(empresa.id, comuna.id, 'BOD-B')
    const unidad = await crearUnidad(empresa.id)
    const articulo = await crearArticulo(empresa.id, unidad.id, 'ART-001')
    const tipoEntrada = await crearTipoMovimiento(empresa.id, 'ENT', 'ENTRADA')
    const tipoSalida = await crearTipoMovimiento(empresa.id, 'SAL', 'SALIDA')
    const tipoTraslado = await crearTipoMovimiento(empresa.id, 'TRA', 'TRASLADO')

    // Día 1: dos entradas a Bodega A -> cantidad 150, PMP (100*10+50*16)/150=12
    await crearMovimiento({
      empresaId: empresa.id, tipoMovimientoId: tipoEntrada.id, fechaMovimiento: '2026-01-01',
      bodegaDestinoId: bodegaA.id, articuloId: articulo.id, cantidad: 100, precioUnitario: 10,
    })
    await crearMovimiento({
      empresaId: empresa.id, tipoMovimientoId: tipoEntrada.id, fechaMovimiento: '2026-01-01',
      bodegaDestinoId: bodegaA.id, articuloId: articulo.id, cantidad: 50, precioUnitario: 16,
    })
    // Día 2: salida de 30 (no cambia PMP) y traslado A->B de 20 (el PMP viaja)
    await crearMovimiento({
      empresaId: empresa.id, tipoMovimientoId: tipoSalida.id, fechaMovimiento: '2026-01-02',
      bodegaOrigenId: bodegaA.id, articuloId: articulo.id, cantidad: 30,
    })
    await crearMovimiento({
      empresaId: empresa.id, tipoMovimientoId: tipoTraslado.id, fechaMovimiento: '2026-01-02',
      bodegaOrigenId: bodegaA.id, bodegaDestinoId: bodegaB.id, articuloId: articulo.id, cantidad: 20,
    })

    // Consolidado: el traslado interno no cambia el total de la empresa.
    const consolidado = await empresaContext.run({ empresaId: empresa.id }, () => obtenerKardex({ articuloId: articulo.id }))
    expect(consolidado.rows).toHaveLength(4)
    expect(consolidado.saldoFinal.cantidad).toBeCloseTo(120) // 100+50-30
    expect(consolidado.saldoFinal.costoPromedio).toBeCloseTo(12)
    expect(consolidado.rows[3].cantidadEntrada).toBe(0)
    expect(consolidado.rows[3].cantidadSalida).toBe(0)

    // Bodega A: recibe ambas entradas, la salida y el traslado (como salida)
    const kardexA = await empresaContext.run(
      { empresaId: empresa.id },
      () => obtenerKardex({ articuloId: articulo.id, bodegaId: bodegaA.id }),
    )
    expect(kardexA.rows).toHaveLength(4)
    expect(kardexA.saldoFinal.cantidad).toBeCloseTo(100) // 100+50-30-20
    expect(kardexA.saldoFinal.costoPromedio).toBeCloseTo(12)

    // Bodega B: solo ve el traslado, arrancando desde saldo 0
    const kardexB = await empresaContext.run(
      { empresaId: empresa.id },
      () => obtenerKardex({ articuloId: articulo.id, bodegaId: bodegaB.id }),
    )
    expect(kardexB.rows).toHaveLength(1)
    expect(kardexB.saldoInicial.cantidad).toBe(0)
    expect(kardexB.rows[0].cantidadEntrada).toBe(20)
    expect(kardexB.saldoFinal.cantidad).toBeCloseTo(20)
    expect(kardexB.saldoFinal.costoPromedio).toBeCloseTo(12)

    // Rango de fechas: consultar Bodega A desde el día 2 debe partir con el
    // saldo acumulado del día 1 (150 @ PMP 12) como saldo inicial.
    const rango = await empresaContext.run(
      { empresaId: empresa.id },
      () => obtenerKardex({ articuloId: articulo.id, bodegaId: bodegaA.id, fechaDesde: '2026-01-02' }),
    )
    expect(rango.rows).toHaveLength(2)
    expect(rango.saldoInicial.cantidad).toBeCloseTo(150)
    expect(rango.saldoInicial.costoPromedio).toBeCloseTo(12)
    expect(rango.saldoFinal.cantidad).toBeCloseTo(100)
  })

  it('rechaza un artículo inexistente', async () => {
    const empresa = await obtenerEmpresaTest()
    await expect(
      empresaContext.run({ empresaId: empresa.id }, () => obtenerKardex({ articuloId: 999999 })),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})
