import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma.js'
import {
  crearNotaVenta,
  agregarDetalle,
  actualizarNotaVenta,
  eliminarNotaVenta,
} from '../../src/modules/ventas/notas-venta/notas-venta.service.js'
import { crearInstructivo } from '../../src/modules/compras/instructivo-embalaje/instructivo-embalaje.service.js'

const databaseName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1)
if (databaseName !== 'fas_test') {
  throw new Error(`Seguridad: las pruebas de Ventas/Compras requieren fas_test; recibido "${databaseName}"`)
}

async function limpiarDatos() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "instructivo_embalaje_detalle",
      "instructivos_embalaje",
      "notas_venta_detalle_calibre",
      "notas_venta_detalle",
      "notas_venta",
      "articulos",
      "calibres",
      "categorias",
      "variedades",
      "especies",
      "mercados",
      "grupos_mercado",
      "monedas",
      "tipos_embarque",
      "entidades",
      "paises"
    RESTART IDENTITY CASCADE
  `)
}

async function crearFixtures() {
  const pais = await prisma.pais.create({ data: { codigo: 'CHL', descripcion: 'Chile', creadoPor: 'test' } })
  const cliente = await prisma.entidad.create({
    data: { codigo: 'CLI-01', descripcion: 'Cliente Uno', razonSocial: 'Cliente Uno SpA', paisId: pais.id, tipos: ['CLIENTE_NACIONAL'], creadoPor: 'test' },
  })
  const productor = await prisma.entidad.create({
    data: { codigo: 'PROD-01', descripcion: 'Productor Uno', razonSocial: 'Productor Uno SpA', paisId: pais.id, tipos: ['PRODUCTOR'], creadoPor: 'test' },
  })
  const tipoEmbarque = await prisma.tipoEmbarque.create({ data: { codigo: 'MARIT', descripcion: 'Marítimo', creadoPor: 'test' } })
  const grupoMercado = await prisma.grupoMercado.create({ data: { codigo: 'GM1', descripcion: 'Grupo 1', creadoPor: 'test' } })
  const mercado = await prisma.mercado.create({ data: { codigo: 'MK1', descripcion: 'Mercado 1', grupoMercadoId: grupoMercado.id, paisId: pais.id, creadoPor: 'test' } })
  const moneda = await prisma.moneda.create({ data: { codigo: 'USD', descripcion: 'Dólar', creadoPor: 'test' } })
  const especie = await prisma.especie.create({ data: { codigo: 'UV', descripcion: 'Uva', creadoPor: 'test' } })
  const variedad = await prisma.variedad.create({ data: { codigo: 'RG', descripcion: 'Red Globe', especieId: especie.id, creadoPor: 'test' } })
  const categoria = await prisma.categoria.create({ data: { codigo: 'CAT1', descripcion: 'Categoría 1', especieId: especie.id, orden: 1, control: [], creadoPor: 'test' } })
  const calibreChico = await prisma.calibre.create({ data: { codigo: 'XL', descripcion: 'XL', especieId: especie.id, orden: 1, control: [], creadoPor: 'test' } })
  const calibreGrande = await prisma.calibre.create({ data: { codigo: 'XXL', descripcion: 'XXL', especieId: especie.id, orden: 2, control: [], creadoPor: 'test' } })
  const unidad = await prisma.unidadMedida.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, codigo: 'CAJA', descripcion: 'Caja', creadoPor: 'test' },
  })
  const articulo = await prisma.articulo.create({
    data: { tipo: 'EMBALAJE', codigo: 'ART-EMB', descripcion: 'Caja embalaje', unidadId: unidad.id, tipoCosteo: 'PROMEDIO_PONDERADO' },
  })

  return { pais, cliente, productor, tipoEmbarque, mercado, moneda, especie, variedad, categoria, calibreChico, calibreGrande, articulo }
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
  afterAll(async () => {
    await limpiarDatos()
    await prisma.$disconnect()
  })

  it('genera folios correlativos y rechaza cliente sin tipo Cliente', async () => {
    const f = await crearFixtures()
    const nv1 = await crearNotaVenta(nvBase(f), 'test')
    const nv2 = await crearNotaVenta(nvBase(f), 'test')
    expect(nv1.folio).toBe(1)
    expect(nv2.folio).toBe(2)

    await expect(
      crearNotaVenta({ ...nvBase(f), clienteId: f.productor.id }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('valida especie/variedad/categoría/calibre y tipo Embalaje del artículo en el detalle de NV', async () => {
    const f = await crearFixtures()
    const nv = await crearNotaVenta(nvBase(f), 'test')

    const otraEspecie = await prisma.especie.create({ data: { codigo: 'CZ', descripcion: 'Cereza', creadoPor: 'test' } })
    const variedadOtraEspecie = await prisma.variedad.create({ data: { codigo: 'BING', descripcion: 'Bing', especieId: otraEspecie.id, creadoPor: 'test' } })

    await expect(
      agregarDetalle(nv.id, {
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
      data: { tipo: 'SERVICIO', codigo: 'ART-SRV', descripcion: 'Servicio', unidadId: (await prisma.unidadMedida.findFirstOrThrow()).id, tipoCosteo: 'PROMEDIO_PONDERADO' },
    })
    await expect(
      agregarDetalle(nv.id, {
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

    const detalle = await agregarDetalle(nv.id, {
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
    const nv = await crearNotaVenta(nvBase(f), 'test')

    await expect(
      crearInstructivo({
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

    const instructivo = await crearInstructivo({
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
    const nv = await crearNotaVenta(nvBase(f), 'test')
    await crearInstructivo({
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

    const editada = await actualizarNotaVenta(nv.id, { observaciones: 'edición permitida' }, 'test')
    expect(editada.observaciones).toBe('edición permitida')

    await expect(eliminarNotaVenta(nv.id, 'test')).resolves.toBeUndefined()
  })

  it('rechaza referencias bloqueadas o eliminadas en el encabezado de NV', async () => {
    const f = await crearFixtures()
    await prisma.mercado.update({ where: { id: f.mercado.id }, data: { bloqueado: true } })

    await expect(crearNotaVenta(nvBase(f), 'test')).rejects.toMatchObject({ statusCode: 422 })
  })
})
