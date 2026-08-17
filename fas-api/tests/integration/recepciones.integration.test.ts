import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { prisma } from '../../src/lib/prisma.js'
import { empresaContext } from '../../src/lib/empresa-context.js'
import { crearRecepcion as crearRecepcionSvc, subirAdjunto as subirAdjuntoSvc, obtenerRecepcion as obtenerRecepcionSvc } from '../../src/modules/compras/recepciones/recepciones.service.js'
import {
  crearOrdenCompra as crearOrdenCompraSvc,
  actualizarOrdenCompra as actualizarOrdenCompraSvc,
  agregarLinea as agregarLineaSvc,
} from '../../src/modules/compras/ordenes-compra/ordenes-compra.service.js'
import { crearSolicitud as crearSolicitudSvc, notificarSolicitud as notificarSolicitudSvc, cerrarSolicitud as cerrarSolicitudSvc } from '../../src/modules/calidad/solicitudes/solicitudes.service.js'
import type { RecepcionCreateInput } from '../../src/modules/compras/recepciones/recepciones.types.js'
import type { OrdenCompraCreateInput, OrdenCompraLineaCreateInput } from '../../src/modules/compras/ordenes-compra/ordenes-compra.types.js'
import type { SolicitudCreateBody } from '../../src/modules/calidad/solicitudes/solicitudes.schema.js'

// Mismo patrón que ventas-compras.integration.test.ts: los servicios que usan
// prisma.$transaction() internamente pierden el contexto ALS si solo se
// establece con enterWith en beforeEach — se envuelve cada llamada en `.run()`.
async function crearRecepcion(empresaId: number, body: RecepcionCreateInput, userId: string) {
  return empresaContext.run({ empresaId }, () => crearRecepcionSvc(body, userId))
}
async function subirAdjunto(empresaId: number, recepcionId: number, archivo: { nombre: string; mime: string; datos: Buffer }, userId: string) {
  return empresaContext.run({ empresaId }, () => subirAdjuntoSvc(recepcionId, archivo, userId))
}
async function obtenerRecepcion(empresaId: number, id: number) {
  return empresaContext.run({ empresaId }, () => obtenerRecepcionSvc(id))
}
async function crearOrdenCompra(empresaId: number, body: OrdenCompraCreateInput, userId: string) {
  return empresaContext.run({ empresaId }, () => crearOrdenCompraSvc(body, userId))
}
async function actualizarOrdenCompra(empresaId: number, id: number, body: { estado: string }, userId: string) {
  return empresaContext.run({ empresaId }, () => actualizarOrdenCompraSvc(id, body, userId))
}
async function agregarLinea(empresaId: number, ordenCompraId: number, body: OrdenCompraLineaCreateInput) {
  return empresaContext.run({ empresaId }, () => agregarLineaSvc(ordenCompraId, body))
}
async function crearSolicitudInspeccion(empresaId: number, body: SolicitudCreateBody, userId: string) {
  return empresaContext.run({ empresaId }, () => crearSolicitudSvc(body, userId))
}
async function notificarSolicitudInspeccion(empresaId: number, id: number, userId: string) {
  return empresaContext.run({ empresaId }, () => notificarSolicitudSvc(id, userId))
}
async function cerrarSolicitudInspeccion(empresaId: number, id: number, resultado: 'APROBADA' | 'RECHAZADA', userId: string) {
  return empresaContext.run({ empresaId }, () => cerrarSolicitudSvc(id, { comentarios: 'OK', resultado }, userId, true))
}

const databaseName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1)
if (databaseName !== 'fas_test') {
  throw new Error(`Seguridad: las pruebas de Recepción requieren fas_test; recibido "${databaseName}"`)
}

async function limpiarDatos() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "pallet_lineas",
      "pallets",
      "recepcion_adjuntos_contenido",
      "recepcion_adjuntos",
      "recepciones",
      "templates_carga_campos",
      "templates_carga",
      "orden_compra_linea",
      "orden_compra_cuota_pago",
      "ordenes_compra",
      "articulos",
      "monedas",
      "calibres",
      "categorias",
      "variedades",
      "grupos_variedad",
      "especies",
      "entidad_direcciones",
      "entidades",
      "paises",
      "temporadas",
      "usuarios",
      "perfiles"
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
  const planta = await prisma.entidad.create({
    data: { empresaId: empresa.id, codigo: 'PLANTA-01', descripcion: 'Planta Uno', razonSocial: 'Planta Uno SpA', paisId: pais.id, tipos: ['PLANTA'], creadoPor: 'test' },
  })
  const direccionPlanta = await prisma.entidadDireccion.create({
    data: { entidadId: planta.id, codigo: 'DIR-1', descripcion: 'Bodega Central', paisId: pais.id, direccion: 'Camino a la Planta 123', creadoPor: 'test' },
  })
  // La Solicitud de Inspección exige una dirección del PRODUCTOR (no de la
  // planta) — distinta de direccionPlanta, que es la que usa la Recepción.
  const direccionProductor = await prisma.entidadDireccion.create({
    data: { entidadId: productor.id, codigo: 'DIR-PROD', descripcion: 'Predio', paisId: pais.id, direccion: 'Camino Rural s/n', creadoPor: 'test' },
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

  const perfilInspector = await prisma.perfil.create({ data: { codigo: 'PERFIL-INSPECTOR', descripcion: 'Inspector', creadoPor: 'test' } })
  const usuarioInspector = await prisma.usuario.create({
    data: { id: 'usuario-inspector', nombre: 'Usuario Inspector', email: 'inspector@example.invalid', perfilId: perfilInspector.id, creadoPor: 'test' },
  })
  const temporada = await prisma.temporada.create({
    data: { empresaId: empresa.id, codigo: 'TEMP-1', descripcion: 'Temporada 1', fechaInicio: new Date('2026-01-01'), fechaTermino: new Date('2026-12-31'), creadoPor: 'test' },
  })
  const solicitudCreada = await crearSolicitudInspeccion(empresa.id, {
    temporadaId: temporada.id,
    usuarioSolicitanteId: usuarioInspector.id,
    entidadProductorId: productor.id,
    direccionId: direccionProductor.id,
    tipoInspeccion: 'COMPRA',
    fechaHora: new Date('2026-08-01T15:00:00Z').toISOString(),
    asignados: [{ usuarioId: usuarioInspector.id, funcion: 'ACUDIR' }],
  }, 'test')
  await notificarSolicitudInspeccion(empresa.id, solicitudCreada.id, 'test')
  const solicitudInspeccionCompraAprobada = await cerrarSolicitudInspeccion(empresa.id, solicitudCreada.id, 'APROBADA', 'test')

  return { empresa, pais, productor, planta, direccionPlanta, especie, variedad, categoria, calibreChico, calibreGrande, articulo, solicitudInspeccionCompraAprobada }
}

// TemplateCarga con cabecera (título de columna = nombre del campo, simple
// de armar en el Excel del test) — mismo shape que arma el mantenedor real.
async function crearTemplateCarga(empresaId: number) {
  return prisma.templateCarga.create({
    data: {
      empresaId,
      codigo: 'TPL-REC-01',
      tipo: 'RECEPCION',
      descripcion: 'Template de prueba',
      tieneCabecera: true,
      filaCabecera: 1,
      filaPrimerRegistro: 2,
      creadoPor: 'test',
      campos: {
        create: [
          { campo: 'NUMERO_PALLET', columna: 'Pallet' },
          { campo: 'ESPECIE', columna: 'Especie' },
          { campo: 'VARIEDAD', columna: 'Variedad' },
          { campo: 'CATEGORIA', columna: 'Categoria' },
          { campo: 'ARTICULO', columna: 'Articulo' },
          { campo: 'CALIBRE', columna: 'Calibre' },
          { campo: 'CAJAS', columna: 'Cajas' },
          { campo: 'PRODUCTOR', columna: 'Productor' },
        ],
      },
    },
  })
}

interface FilaTestExcel {
  pallet: string
  especie: string
  variedad: string
  categoria: string
  articulo: string
  calibre: string
  cajas: number | string // string para forzar un valor no numérico en los tests de Etapa 2
  productor: string
}

async function armarExcel(filas: FilaTestExcel[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const hoja = wb.addWorksheet('Recepcion')
  hoja.addRow(['Pallet', 'Especie', 'Variedad', 'Categoria', 'Articulo', 'Calibre', 'Cajas', 'Productor'])
  for (const f of filas) {
    hoja.addRow([f.pallet, f.especie, f.variedad, f.categoria, f.articulo, f.calibre, f.cajas, f.productor])
  }
  const arrayBuffer = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function filaBase(f: Awaited<ReturnType<typeof crearFixtures>>, overrides: Partial<FilaTestExcel> = {}): FilaTestExcel {
  return {
    pallet: 'P-001',
    especie: 'uva', // minúscula a propósito: matching debe ser case-insensitive
    variedad: 'RED GLOBE', // mayúscula a propósito
    categoria: 'CAT1',
    articulo: 'ART-EMB',
    calibre: 'XL',
    cajas: 100,
    productor: 'PROD-01',
    ...overrides,
  }
}

describe('Motor de validación de Recepción contra PostgreSQL (compras.md §7)', () => {
  beforeEach(limpiarDatos)
  beforeEach(entrarContextoEmpresa)
  afterAll(async () => {
    await limpiarDatos()
    await prisma.$disconnect()
  })

  async function crearOcEmitida(f: Awaited<ReturnType<typeof crearFixtures>>, cajas: number, cantidadPallets: number) {
    const oc = await crearOrdenCompra(f.empresa.id, {
      entidadProductorId: f.productor.id,
      solicitudInspeccionId: f.solicitudInspeccionCompraAprobada.id,
      monedaId: (await prisma.moneda.create({ data: { codigo: 'USD', descripcion: 'Dólar', creadoPor: 'test' } })).id,
    }, 'test')
    await agregarLinea(f.empresa.id, oc.id, {
      especieId: f.especie.id,
      variedadId: f.variedad.id,
      categoriaId: f.categoria.id,
      articuloId: f.articulo.id,
      calibreIds: [f.calibreChico.id],
      cantidadPallets,
      cajasPorPallet: 100,
      cajas,
      precioUsdCaja: 8.5,
    })
    return actualizarOrdenCompra(f.empresa.id, oc.id, { estado: 'EMITIDA' }, 'test')
  }

  it('modo COMPRA: si el Excel cuadra con la OC, genera pallets/líneas y pasa a VALIDADA', async () => {
    const f = await crearFixtures()
    const oc = await crearOcEmitida(f, 100, 1)
    const template = await crearTemplateCarga(f.empresa.id)
    const recepcion = await crearRecepcion(f.empresa.id, {
      ordenCompraId: oc.id,
      plantaId: f.planta.id,
      direccionPlantaId: f.direccionPlanta.id,
      templateCargaId: template.id,
    }, 'test')

    const excel = await armarExcel([filaBase(f)])
    const resultado = await subirAdjunto(f.empresa.id, recepcion.id, { nombre: 'recepcion.xlsx', mime: MIME_XLSX, datos: excel }, 'test')

    expect(resultado.recepcion.estado).toBe('VALIDADA')
    expect(resultado.resumen).toEqual({ pallets: 1, cajas: 100 })

    const pallets = await prisma.pallet.findMany({ where: { recepcionId: recepcion.id }, include: { lineas: true } })
    expect(pallets).toHaveLength(1)
    expect(pallets[0].numeroPallet).toBe('P-001')
    expect(pallets[0].origen).toBe('COMPRA')
    expect(pallets[0].productorId).toBe(f.productor.id)
    expect(pallets[0].lineas).toHaveLength(1)
    expect(pallets[0].lineas[0].cajas).toBe(100)
    expect(pallets[0].lineas[0].calibreId).toBe(f.calibreChico.id)
  })

  it('ignora las filas de cierre (Total, Firma...) después del último pallet en vez de rechazarlas como error', async () => {
    const f = await crearFixtures()
    const oc = await crearOcEmitida(f, 100, 1)
    const template = await crearTemplateCarga(f.empresa.id)
    const recepcion = await crearRecepcion(f.empresa.id, {
      ordenCompraId: oc.id,
      plantaId: f.planta.id,
      direccionPlantaId: f.direccionPlanta.id,
      templateCargaId: template.id,
    }, 'test')

    // Packing List real típico: después del último pallet vienen filas de
    // cierre (Total, Firma Despachador...) con texto suelto en alguna
    // columna pero SIN N° de Pallet propio — no deben tratarse como datos.
    const excel = await armarExcel([
      filaBase(f),
      { pallet: '', especie: 'TOTAL', variedad: '', categoria: '', articulo: '', calibre: '', cajas: 100, productor: '' },
      { pallet: '', especie: 'Firma Despachador', variedad: '', categoria: '', articulo: '', calibre: '', cajas: '', productor: '' },
    ])
    const resultado = await subirAdjunto(f.empresa.id, recepcion.id, { nombre: 'recepcion.xlsx', mime: MIME_XLSX, datos: excel }, 'test')

    expect(resultado.recepcion.estado).toBe('VALIDADA')
    expect(resultado.resumen).toEqual({ pallets: 1, cajas: 100 })
  })

  it('modo COMPRA: rechaza todo-o-nada si las cajas no cuadran, y no genera ningún pallet', async () => {
    const f = await crearFixtures()
    const oc = await crearOcEmitida(f, 100, 1)
    const template = await crearTemplateCarga(f.empresa.id)
    const recepcion = await crearRecepcion(f.empresa.id, {
      ordenCompraId: oc.id,
      plantaId: f.planta.id,
      direccionPlantaId: f.direccionPlanta.id,
      templateCargaId: template.id,
    }, 'test')

    const excel = await armarExcel([filaBase(f, { cajas: 80 })]) // OC pide 100
    await expect(
      subirAdjunto(f.empresa.id, recepcion.id, { nombre: 'recepcion.xlsx', mime: MIME_XLSX, datos: excel }, 'test'),
    ).rejects.toMatchObject({
      statusCode: 422,
      details: { diferencias: [expect.stringContaining('Cajas')] },
    })

    const pallets = await prisma.pallet.count({ where: { recepcionId: recepcion.id } })
    expect(pallets).toBe(0)
    const recepcionFinal = await obtenerRecepcion(f.empresa.id, recepcion.id)
    expect(recepcionFinal.estado).toBe('RECHAZADA')
  })

  it('modo COMPRA: rechaza un calibre fuera de la lista permitida de la OC', async () => {
    const f = await crearFixtures()
    const oc = await crearOcEmitida(f, 100, 1) // solo permite calibreChico (XL)
    const template = await crearTemplateCarga(f.empresa.id)
    const recepcion = await crearRecepcion(f.empresa.id, {
      ordenCompraId: oc.id,
      plantaId: f.planta.id,
      direccionPlantaId: f.direccionPlanta.id,
      templateCargaId: template.id,
    }, 'test')

    const excel = await armarExcel([filaBase(f, { calibre: 'XXL' })]) // no está en la lista de la OC
    await expect(
      subirAdjunto(f.empresa.id, recepcion.id, { nombre: 'recepcion.xlsx', mime: MIME_XLSX, datos: excel }, 'test'),
    ).rejects.toMatchObject({
      statusCode: 422,
      details: { diferencias: [expect.stringContaining('Calibre')] },
    })
  })

  it('rechaza con el detalle de fila cuando un texto del Excel no existe en los maestros', async () => {
    const f = await crearFixtures()
    const oc = await crearOcEmitida(f, 100, 1)
    const template = await crearTemplateCarga(f.empresa.id)
    const recepcion = await crearRecepcion(f.empresa.id, {
      ordenCompraId: oc.id,
      plantaId: f.planta.id,
      direccionPlantaId: f.direccionPlanta.id,
      templateCargaId: template.id,
    }, 'test')

    const excel = await armarExcel([filaBase(f, { variedad: 'Variedad Inexistente' })])
    await expect(
      subirAdjunto(f.empresa.id, recepcion.id, { nombre: 'recepcion.xlsx', mime: MIME_XLSX, datos: excel }, 'test'),
    ).rejects.toMatchObject({
      statusCode: 422,
      details: { diferencias: [expect.stringContaining('Variedad "Variedad Inexistente" no existe')] },
    })
  })

  it('Etapa 1: junta TODAS las columnas del Template que no coinciden con el Excel, no solo la primera', async () => {
    const f = await crearFixtures()
    const oc = await crearOcEmitida(f, 100, 1)
    const templateMalMapeado = await prisma.templateCarga.create({
      data: {
        empresaId: f.empresa.id,
        codigo: 'TPL-MAL-01',
        tipo: 'RECEPCION',
        descripcion: 'Template con columnas mal mapeadas',
        tieneCabecera: true,
        filaCabecera: 1,
        filaPrimerRegistro: 2,
        creadoPor: 'test',
        campos: {
          create: [
            { campo: 'NUMERO_PALLET', columna: 'ColumnaQueNoExiste1' },
            { campo: 'ESPECIE', columna: 'ColumnaQueNoExiste2' },
            { campo: 'VARIEDAD', columna: 'Variedad' },
            { campo: 'CATEGORIA', columna: 'Categoria' },
            { campo: 'ARTICULO', columna: 'Articulo' },
            { campo: 'CALIBRE', columna: 'Calibre' },
            { campo: 'CAJAS', columna: 'Cajas' },
            { campo: 'PRODUCTOR', columna: 'Productor' },
          ],
        },
      },
    })
    const recepcion = await crearRecepcion(f.empresa.id, {
      ordenCompraId: oc.id,
      plantaId: f.planta.id,
      direccionPlantaId: f.direccionPlanta.id,
      templateCargaId: templateMalMapeado.id,
    }, 'test')

    const excel = await armarExcel([filaBase(f)])
    await expect(
      subirAdjunto(f.empresa.id, recepcion.id, { nombre: 'recepcion.xlsx', mime: MIME_XLSX, datos: excel }, 'test'),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('Etapa 1'),
      details: {
        diferencias: expect.arrayContaining([
          expect.stringContaining('ColumnaQueNoExiste1'),
          expect.stringContaining('ColumnaQueNoExiste2'),
        ]),
      },
    })
  })

  it('Etapa 2: junta TODOS los errores de filas incompletas/inválidas, no solo el primero', async () => {
    const f = await crearFixtures()
    const oc = await crearOcEmitida(f, 100, 1)
    const template = await crearTemplateCarga(f.empresa.id)
    const recepcion = await crearRecepcion(f.empresa.id, {
      ordenCompraId: oc.id,
      plantaId: f.planta.id,
      direccionPlantaId: f.direccionPlanta.id,
      templateCargaId: template.id,
    }, 'test')

    const excel = await armarExcel([
      filaBase(f, { pallet: 'P-001', especie: '' }),
      filaBase(f, { pallet: 'P-002', productor: '' }),
      filaBase(f, { pallet: 'P-003', cajas: 'no-es-numero' }),
    ])
    await expect(
      subirAdjunto(f.empresa.id, recepcion.id, { nombre: 'recepcion.xlsx', mime: MIME_XLSX, datos: excel }, 'test'),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('Etapa 2'),
      details: {
        diferencias: expect.arrayContaining([
          expect.stringContaining('falta la Especie'),
          expect.stringContaining('falta el Productor'),
          expect.stringContaining('no es un número entero válido'),
        ]),
      },
    })
  })

  it('Etapa 3: junta TODOS los errores de maestros no encontrados en distintas filas, no solo el primero', async () => {
    const f = await crearFixtures()
    const oc = await crearOcEmitida(f, 100, 1)
    const template = await crearTemplateCarga(f.empresa.id)
    const recepcion = await crearRecepcion(f.empresa.id, {
      ordenCompraId: oc.id,
      plantaId: f.planta.id,
      direccionPlantaId: f.direccionPlanta.id,
      templateCargaId: template.id,
    }, 'test')

    const excel = await armarExcel([
      filaBase(f, { pallet: 'P-001', variedad: 'Variedad Inexistente' }),
      filaBase(f, { pallet: 'P-002', articulo: 'Articulo Inexistente' }),
      filaBase(f, { pallet: 'P-003', productor: 'PROD-INEXISTENTE' }),
    ])
    await expect(
      subirAdjunto(f.empresa.id, recepcion.id, { nombre: 'recepcion.xlsx', mime: MIME_XLSX, datos: excel }, 'test'),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('Etapa 3'),
      details: {
        diferencias: expect.arrayContaining([
          expect.stringContaining('Variedad "Variedad Inexistente" no existe'),
          expect.stringContaining('Artículo/Embalaje "Articulo Inexistente" no existe'),
          expect.stringContaining('Productor "PROD-INEXISTENTE" no existe'),
        ]),
      },
    })
  })

  it('modo CONSIGNACION: carga libre sin OC, genera pallets y el estado se queda en CARGADA', async () => {
    const f = await crearFixtures()
    const template = await crearTemplateCarga(f.empresa.id)
    const recepcion = await crearRecepcion(f.empresa.id, {
      ordenCompraId: null,
      plantaId: f.planta.id,
      direccionPlantaId: f.direccionPlanta.id,
      templateCargaId: template.id,
    }, 'test')
    expect(recepcion.origen).toBe('CONSIGNACION')

    // En consignación no hay OC contra qué comparar: cualquier combinación pasa.
    const excel = await armarExcel([filaBase(f, { calibre: 'XXL', cajas: 999 })])
    const resultado = await subirAdjunto(f.empresa.id, recepcion.id, { nombre: 'recepcion.xlsx', mime: MIME_XLSX, datos: excel }, 'test')

    expect(resultado.recepcion.estado).toBe('CARGADA') // compras.md §8: consignación no tiene transición a VALIDADA
    const pallets = await prisma.pallet.findMany({ where: { recepcionId: recepcion.id } })
    expect(pallets).toHaveLength(1)
    expect(pallets[0].origen).toBe('CONSIGNACION')

    // Con pallets ya generados, un segundo Excel debe rechazarse (evita duplicar).
    await expect(
      subirAdjunto(f.empresa.id, recepcion.id, { nombre: 'otro.xlsx', mime: MIME_XLSX, datos: excel }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('tras un rechazo, permite corregir y reintentar (RECHAZADA sigue siendo editable/re-cargable)', async () => {
    const f = await crearFixtures()
    const oc = await crearOcEmitida(f, 100, 1)
    const template = await crearTemplateCarga(f.empresa.id)
    const recepcion = await crearRecepcion(f.empresa.id, {
      ordenCompraId: oc.id,
      plantaId: f.planta.id,
      direccionPlantaId: f.direccionPlanta.id,
      templateCargaId: template.id,
    }, 'test')

    const excelMalo = await armarExcel([filaBase(f, { cajas: 50 })])
    await expect(
      subirAdjunto(f.empresa.id, recepcion.id, { nombre: 'malo.xlsx', mime: MIME_XLSX, datos: excelMalo }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })
    expect((await obtenerRecepcion(f.empresa.id, recepcion.id)).estado).toBe('RECHAZADA')

    const excelBueno = await armarExcel([filaBase(f, { cajas: 100 })])
    const resultado = await subirAdjunto(f.empresa.id, recepcion.id, { nombre: 'bueno.xlsx', mime: MIME_XLSX, datos: excelBueno }, 'test')
    expect(resultado.recepcion.estado).toBe('VALIDADA')

    const adjuntos = await prisma.recepcionAdjunto.count({ where: { recepcionId: recepcion.id } })
    expect(adjuntos).toBe(2) // se conserva el intento fallido como evidencia
  })
})
