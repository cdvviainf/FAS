import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma.js'
import { empresaContext } from '../../src/lib/empresa-context.js'
import {
  crearNotaVenta as crearNotaVentaSvc,
  agregarDetalle as agregarDetalleSvc,
  actualizarNotaVenta as actualizarNotaVentaSvc,
  eliminarNotaVenta as eliminarNotaVentaSvc,
} from '../../src/modules/ventas/notas-venta/notas-venta.service.js'
import { crearInstructivo as crearInstructivoSvc } from '../../src/modules/compras/instructivo-embalaje/instructivo-embalaje.service.js'
import {
  crearOrdenCompra,
  actualizarOrdenCompra,
  eliminarOrdenCompra,
  obtenerOrdenCompra,
} from '../../src/modules/compras/ordenes-compra/ordenes-compra.service.js'
import type { NotaVentaCreateInput, NotaVentaUpdateInput, NotaVentaDetalleCreateInput } from '../../src/modules/ventas/notas-venta/notas-venta.types.js'
import type { InstructivoEmbalajeCreateInput } from '../../src/modules/compras/instructivo-embalaje/instructivo-embalaje.types.js'

// NotaVenta/InstructivoEmbalaje son por-empresa desde Fase 3 (lote Ventas) —
// sus repos crean la fila DENTRO de un prisma.$transaction(), y
// getEmpresaIdActual() ahí devuelve null cuando el contexto ALS se estableció
// vía `entrarContextoEmpresa` (enterWith) en el beforeEach: Codex demostró
// que enterWith no se propaga de forma confiable a través del límite de una
// transacción de Prisma (FAS-EMP-F3-VEN, tests ronda 2). Se envuelve cada
// llamada individualmente en `.run()` en vez de depender del beforeEach
// compartido — mismo patrón ya usado en el lote Calidad/Materiales.
async function crearNotaVenta(empresaId: number, body: NotaVentaCreateInput, userId: string) {
  return empresaContext.run({ empresaId }, () => crearNotaVentaSvc(body, userId))
}
async function actualizarNotaVenta(empresaId: number, id: number, body: NotaVentaUpdateInput, userId: string) {
  return empresaContext.run({ empresaId }, () => actualizarNotaVentaSvc(id, body, userId))
}
async function eliminarNotaVenta(empresaId: number, id: number, userId: string) {
  return empresaContext.run({ empresaId }, () => eliminarNotaVentaSvc(id, userId))
}
async function agregarDetalle(empresaId: number, notaVentaId: number, body: NotaVentaDetalleCreateInput) {
  return empresaContext.run({ empresaId }, () => agregarDetalleSvc(notaVentaId, body))
}
async function crearInstructivo(empresaId: number, body: InstructivoEmbalajeCreateInput, userId: string) {
  return empresaContext.run({ empresaId }, () => crearInstructivoSvc(body, userId))
}

const databaseName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1)
if (databaseName !== 'fas_test') {
  throw new Error(`Seguridad: las pruebas de Ventas/Compras requieren fas_test; recibido "${databaseName}"`)
}

async function limpiarDatos() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "orden_compra_linea",
      "orden_compra_cuota_pago",
      "ordenes_compra",
      "condicion_pago_cuota",
      "condiciones_pago",
      "instructivo_embalaje_detalle",
      "instructivos_embalaje",
      "notas_venta_detalle",
      "notas_venta",
      "articulos",
      "calibres",
      "categorias",
      "variedades",
      "grupos_variedad",
      "especies",
      "mercados",
      "grupos_mercado",
      "monedas",
      "tipos_embarque",
      "entidades",
      "paises",
      "usuarios",
      "perfiles"
    RESTART IDENTITY CASCADE
  `)
}

async function crearUsuarioResponsable(esResponsableVenta: boolean, codigoSufijo: string) {
  const perfil = await prisma.perfil.create({
    data: { codigo: `PERFIL-${codigoSufijo}`, descripcion: 'Perfil de prueba', creadoPor: 'test' },
  })
  return prisma.usuario.create({
    data: {
      id: `usuario-${codigoSufijo}`,
      nombre: `Usuario ${codigoSufijo}`,
      email: `usuario-${codigoSufijo}@example.invalid`,
      perfilId: perfil.id,
      esResponsableVenta,
      creadoPor: 'test',
    },
  })
}

async function crearCondicionPago(cuotas: { porcentaje: number; plazoDias: number }[]) {
  return prisma.condicionPago.create({
    data: {
      codigo: 'CP-30-60',
      descripcion: '50/50 a 30 y 60 días',
      tipo: 'COMPRA',
      creadoPor: 'test',
      cuotas: { create: cuotas },
    },
    include: { cuotas: true },
  })
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

// Muchos de los servicios probados en este archivo (crearNotaVenta,
// agregarDetalle, crearOrdenCompra, etc.) validan FKs contra modelos
// por-empresa desde Fase 3 (TipoEmbarque, Especie, Variedad, Categoria,
// Calibre...) — necesitan contexto ALS, que fuera de un request HTTP no
// existe por defecto. `enterWith` (a diferencia de `.run()`) no requiere
// envolver cada test individualmente: alcanza con llamarlo una vez por test
// desde `beforeEach`, y el contexto persiste para toda la ejecución async de
// ese test (Node propaga el store de ALS a través de la cadena causal).
async function entrarContextoEmpresa() {
  const empresa = await obtenerEmpresaTest()
  empresaContext.enterWith({ empresaId: empresa.id })
}

async function crearFixtures() {
  const empresa = await obtenerEmpresaTest()
  const grupoMercado = await prisma.grupoMercado.create({ data: { empresaId: empresa.id, codigo: 'GM1', descripcion: 'Grupo 1', creadoPor: 'test' } })
  const mercado = await prisma.mercado.create({ data: { empresaId: empresa.id, codigo: 'MK1', descripcion: 'Mercado 1', grupoMercadoId: grupoMercado.id, creadoPor: 'test' } })
  const pais = await prisma.pais.create({ data: { codigo: 'CHL', descripcion: 'Chile', creadoPor: 'test' } })
  await prisma.mercadoPais.create({
    data: { empresaId: empresa.id, mercadoId: mercado.id, paisId: pais.id, creadoPor: 'test' },
  })
  const cliente = await prisma.entidad.create({
    data: { empresaId: empresa.id, codigo: 'CLI-01', descripcion: 'Cliente Uno', razonSocial: 'Cliente Uno SpA', paisId: pais.id, tipos: ['CLIENTE_NACIONAL'], creadoPor: 'test' },
  })
  const productor = await prisma.entidad.create({
    data: { empresaId: empresa.id, codigo: 'PROD-01', descripcion: 'Productor Uno', razonSocial: 'Productor Uno SpA', paisId: pais.id, tipos: ['PRODUCTOR'], creadoPor: 'test' },
  })
  const tipoEmbarque = await prisma.tipoEmbarque.create({ data: { empresaId: empresa.id, codigo: 'MARIT', descripcion: 'Marítimo', creadoPor: 'test' } })
  const moneda = await prisma.moneda.create({ data: { codigo: 'USD', descripcion: 'Dólar', creadoPor: 'test' } })
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

  return { empresa, pais, cliente, productor, tipoEmbarque, mercado, moneda, especie, variedad, categoria, calibreChico, calibreGrande, articulo }
}

function nvBase(f: Awaited<ReturnType<typeof crearFixtures>>) {
  return {
    fecha: new Date(),
    clienteId: f.cliente.id,
    tipoEmbarqueId: f.tipoEmbarque.id,
    mercadoId: f.mercado.id,
    paisDestinoId: f.pais.id,
    monedaId: f.moneda.id,
  }
}

describe('Nota de Venta e Instructivo de Embalaje contra PostgreSQL', () => {
  beforeEach(limpiarDatos)
  beforeEach(entrarContextoEmpresa)
  afterAll(async () => {
    await limpiarDatos()
    await prisma.$disconnect()
  })

  it('genera folios correlativos y rechaza cliente sin tipo Cliente', async () => {
    const f = await crearFixtures()
    const nv1 = await crearNotaVenta(f.empresa.id, nvBase(f), 'test')
    const nv2 = await crearNotaVenta(f.empresa.id, nvBase(f), 'test')
    expect(nv1.folio).toBe(1)
    expect(nv2.folio).toBe(2)

    await expect(
      crearNotaVenta(f.empresa.id, { ...nvBase(f), clienteId: f.productor.id }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('valida especie/variedad/categoría/calibre y tipo Embalaje del artículo en el detalle de NV', async () => {
    const f = await crearFixtures()
    const nv = await crearNotaVenta(f.empresa.id, nvBase(f), 'test')

    const otraEspecie = await prisma.especie.create({ data: { empresaId: f.empresa.id, codigo: 'CZ', descripcion: 'Cereza', creadoPor: 'test' } })
    const grupoVariedadOtraEspecie = await prisma.grupoVariedad.create({ data: { empresaId: f.empresa.id, codigo: 'GV-CZ', descripcion: 'Cereza', especieId: otraEspecie.id, creadoPor: 'test' } })
    const variedadOtraEspecie = await prisma.variedad.create({ data: { empresaId: f.empresa.id, codigo: 'BING', descripcion: 'Bing', especieId: otraEspecie.id, grupoVariedadId: grupoVariedadOtraEspecie.id, creadoPor: 'test' } })

    await expect(
      agregarDetalle(f.empresa.id, nv.id, {
        fechaCompromiso: new Date(),
        especieId: f.especie.id,
        variedadId: variedadOtraEspecie.id,
        articuloId: f.articulo.id,
        cantidadPallets: 1,
        cajasPorPallet: 1,
        cajas: 1,
        precio: 1,
        calibreIds: [f.calibreChico.id],
      }),
    ).rejects.toMatchObject({ statusCode: 422 })

    const noEmbalaje = await prisma.articulo.create({
      data: { empresaId: f.empresa.id, tipo: 'SERVICIO', codigo: 'ART-SRV', descripcion: 'Servicio', unidadId: (await prisma.unidadMedida.findFirstOrThrow()).id, tipoCosteo: 'PROMEDIO_PONDERADO' },
    })
    await expect(
      agregarDetalle(f.empresa.id, nv.id, {
        fechaCompromiso: new Date(),
        especieId: f.especie.id,
        variedadId: f.variedad.id,
        articuloId: noEmbalaje.id,
        cantidadPallets: 1,
        cajasPorPallet: 1,
        cajas: 1,
        precio: 1,
        calibreIds: [f.calibreChico.id],
      }),
    ).rejects.toMatchObject({ statusCode: 422 })

    const detalle = await agregarDetalle(f.empresa.id, nv.id, {
      fechaCompromiso: new Date(),
      especieId: f.especie.id,
      variedadId: f.variedad.id,
      articuloId: f.articulo.id,
      cantidadPallets: 1,
      cajasPorPallet: 1,
      cajas: 1,
      precio: 1,
      calibreIds: [f.calibreChico.id],
    })
    expect(detalle.notaVentaId).toBe(nv.id)
  })

  it('rechaza rango de calibre invertido en Instructivo de Embalaje (compras.md §6.5)', async () => {
    const f = await crearFixtures()
    const nv = await crearNotaVenta(f.empresa.id, nvBase(f), 'test')

    await expect(
      crearInstructivo(f.empresa.id, {
        notaVentaId: nv.id,
        detalle: [{
          articuloId: f.articulo.id,
          especieId: f.especie.id,
          variedadId: f.variedad.id,
          categoriaId: f.categoria.id,
          calibreMinId: f.calibreGrande.id,
          calibreMaxId: f.calibreChico.id,
          cantidadPallets: 1,
          cajasPorPallet: 1,
        }],
      }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })

    const instructivo = await crearInstructivo(f.empresa.id, {
      notaVentaId: nv.id,
      detalle: [{
        articuloId: f.articulo.id,
        especieId: f.especie.id,
        variedadId: f.variedad.id,
        categoriaId: f.categoria.id,
        calibreMinId: f.calibreChico.id,
        calibreMaxId: f.calibreGrande.id,
        cantidadPallets: 1,
        cajasPorPallet: 1,
      }],
    }, 'test')
    expect(instructivo.numero).toBe(1)
  })

  it('el Instructivo de Embalaje NO bloquea la edición ni el borrado de la Nota de Venta (decisión de negocio)', async () => {
    const f = await crearFixtures()
    const nv = await crearNotaVenta(f.empresa.id, nvBase(f), 'test')
    await crearInstructivo(f.empresa.id, {
      notaVentaId: nv.id,
      detalle: [{
        articuloId: f.articulo.id,
        especieId: f.especie.id,
        variedadId: f.variedad.id,
        categoriaId: f.categoria.id,
        calibreMinId: f.calibreChico.id,
        calibreMaxId: f.calibreGrande.id,
        cantidadPallets: 1,
        cajasPorPallet: 1,
      }],
    }, 'test')

    const editada = await actualizarNotaVenta(f.empresa.id, nv.id, { observaciones: 'edición permitida' }, 'test')
    expect(editada.observaciones).toBe('edición permitida')

    await expect(eliminarNotaVenta(f.empresa.id, nv.id, 'test')).resolves.toBeUndefined()
  })

  it('rechaza referencias bloqueadas o eliminadas en el encabezado de NV', async () => {
    const f = await crearFixtures()
    await prisma.mercado.update({ where: { id: f.mercado.id }, data: { bloqueado: true } })

    await expect(crearNotaVenta(f.empresa.id, nvBase(f), 'test')).rejects.toMatchObject({ statusCode: 422 })
  })

  it('NV-IE-009: rechaza un país destino que no pertenece al mercado seleccionado', async () => {
    const f = await crearFixtures()
    const otroMercado = await prisma.mercado.create({
      data: {
        empresaId: f.empresa.id,
        codigo: 'MK2',
        descripcion: 'Mercado 2',
        grupoMercadoId: f.mercado.grupoMercadoId,
        creadoPor: 'test',
      },
    })

    await expect(
      crearNotaVenta(f.empresa.id, { ...nvBase(f), mercadoId: otroMercado.id }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })
  })
})

describe('Orden de Compra contra PostgreSQL', () => {
  beforeEach(limpiarDatos)
  beforeEach(entrarContextoEmpresa)
  afterAll(async () => {
    await limpiarDatos()
    await prisma.$disconnect()
  })

  function ocLinea(f: Awaited<ReturnType<typeof crearFixtures>>) {
    return {
      especieId: f.especie.id,
      variedadId: f.variedad.id,
      categoriaId: f.categoria.id,
      articuloId: f.articulo.id,
      calibreMinId: f.calibreChico.id,
      calibreMaxId: f.calibreGrande.id,
      cantidadPallets: 40,
      cajasPorPallet: 114,
      precioUsdCaja: 8.5,
    }
  }

  it('genera correlativo OC-{año}-{NNNN} y rechaza productor sin tipo Productor', async () => {
    const f = await crearFixtures()
    const oc1 = await crearOrdenCompra({ entidadProductorId: f.productor.id, monedaId: f.moneda.id, lineas: [ocLinea(f)] }, 'test')
    const oc2 = await crearOrdenCompra({ entidadProductorId: f.productor.id, monedaId: f.moneda.id, lineas: [ocLinea(f)] }, 'test')
    const anio = new Date().getFullYear()
    expect(oc1.numero).toBe(`OC-${anio}-0001`)
    expect(oc2.numero).toBe(`OC-${anio}-0002`)

    await expect(
      crearOrdenCompra({ entidadProductorId: f.cliente.id, monedaId: f.moneda.id, lineas: [ocLinea(f)] }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('deriva las cuotas de pago desde la Condición de Pago seleccionada (no se cargan manualmente) y valida el rango de calibre por especie', async () => {
    const f = await crearFixtures()
    const condicionPago = await crearCondicionPago([
      { porcentaje: 80, plazoDias: 30, descripcion: 'Anticipo' },
      { porcentaje: 20, plazoDias: 60, descripcion: 'Saldo' },
    ])

    await expect(
      crearOrdenCompra({
        entidadProductorId: f.productor.id,
        monedaId: f.moneda.id,
        lineas: [{ ...ocLinea(f), calibreMinId: f.calibreGrande.id, calibreMaxId: f.calibreChico.id }],
      }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })

    const oc = await crearOrdenCompra({
      entidadProductorId: f.productor.id,
      monedaId: f.moneda.id,
      condicionPagoId: condicionPago.id,
      lineas: [ocLinea(f)],
    }, 'test')
    expect(oc.cuotasPago).toHaveLength(2)
    expect(oc.cuotasPago.map((c) => Number(c.porcentaje)).sort()).toEqual([20, 80])
    expect(oc.lineas).toHaveLength(1)

    // Sin condición de pago no hay cuotas (no quedan pendientes de carga manual)
    const ocSinCuotas = await crearOrdenCompra({
      entidadProductorId: f.productor.id,
      monedaId: f.moneda.id,
      lineas: [ocLinea(f)],
    }, 'test')
    expect(ocSinCuotas.cuotasPago).toHaveLength(0)
  })

  it('permite editar líneas y cuotas de una OC en Borrador', async () => {
    const f = await crearFixtures()
    const oc = await crearOrdenCompra({ entidadProductorId: f.productor.id, monedaId: f.moneda.id, lineas: [ocLinea(f)] }, 'test')
    expect(oc.estado).toBe('BORRADOR')

    const editada = await actualizarOrdenCompra(oc.id, {
      estado: 'EMITIDA',
      lineas: [{ ...ocLinea(f), cantidadPallets: 50 }],
    }, 'test')
    expect(editada.estado).toBe('EMITIDA')
    expect(editada.lineas).toHaveLength(1)
    expect(editada.lineas[0].cantidadPallets).toBe(50)
  })

  it('rechaza notaVentaId, destinoMercadoId, condicionPagoId y responsableId inexistentes o inválidos', async () => {
    const f = await crearFixtures()
    const usuarioSinFlag = await crearUsuarioResponsable(false, 'no-resp')

    await expect(
      crearOrdenCompra({ entidadProductorId: f.productor.id, monedaId: f.moneda.id, notaVentaId: 999999, lineas: [ocLinea(f)] }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })

    await expect(
      crearOrdenCompra({ entidadProductorId: f.productor.id, monedaId: f.moneda.id, destinoMercadoId: 999999, lineas: [ocLinea(f)] }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })

    await expect(
      crearOrdenCompra({ entidadProductorId: f.productor.id, monedaId: f.moneda.id, condicionPagoId: 999999, lineas: [ocLinea(f)] }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })

    await expect(
      crearOrdenCompra({ entidadProductorId: f.productor.id, monedaId: f.moneda.id, formaPagoId: 999999, lineas: [ocLinea(f)] }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })

    // Solo usuarios marcados como Responsable de Venta pueden asignarse
    await expect(
      crearOrdenCompra({ entidadProductorId: f.productor.id, monedaId: f.moneda.id, responsableId: usuarioSinFlag.id, lineas: [ocLinea(f)] }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })

    const usuarioResponsable = await crearUsuarioResponsable(true, 'si-resp')
    const oc = await crearOrdenCompra({
      entidadProductorId: f.productor.id,
      monedaId: f.moneda.id,
      destinoMercadoId: f.mercado.id,
      responsableId: usuarioResponsable.id,
      lineas: [ocLinea(f)],
    }, 'test')
    expect(oc.destinoMercado?.id).toBe(f.mercado.id)
    expect(oc.responsable?.id).toBe(usuarioResponsable.id)
  })

  it('permite eliminar (soft delete) una OC en Borrador/Emitida, pero bloquea edición y eliminación tras Recepcionada', async () => {
    const f = await crearFixtures()
    const oc = await crearOrdenCompra({ entidadProductorId: f.productor.id, monedaId: f.moneda.id, lineas: [ocLinea(f)] }, 'test')

    await eliminarOrdenCompra(oc.id, 'test')
    await expect(obtenerOrdenCompra(oc.id)).rejects.toMatchObject({ statusCode: 404 })

    // Simula el estado que en el futuro solo asignará el flujo de Recepción
    // (compras.md §4.4/§8) — no seteable manualmente vía la API (OC-001).
    const oc2 = await crearOrdenCompra({ entidadProductorId: f.productor.id, monedaId: f.moneda.id, lineas: [ocLinea(f)] }, 'test')
    await prisma.ordenCompra.update({ where: { id: oc2.id }, data: { estado: 'RECEPCIONADA' } })

    await expect(
      actualizarOrdenCompra(oc2.id, { observaciones: 'no debería aplicar' }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })
    await expect(eliminarOrdenCompra(oc2.id, 'test')).rejects.toMatchObject({ statusCode: 422 })
  })
})
