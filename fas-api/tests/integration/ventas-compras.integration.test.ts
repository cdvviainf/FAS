import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma.js'
import { empresaContext } from '../../src/lib/empresa-context.js'
import {
  crearNotaVenta as crearNotaVentaSvc,
  agregarDetalle as agregarDetalleSvc,
  actualizarNotaVenta as actualizarNotaVentaSvc,
  eliminarNotaVenta as eliminarNotaVentaSvc,
  actualizarDetalle as actualizarDetalleSvc,
  eliminarDetalle as eliminarDetalleSvc,
  listarNotasVenta as listarNotasVentaSvc,
} from '../../src/modules/ventas/notas-venta/notas-venta.service.js'
import { crearInstructivo as crearInstructivoSvc } from '../../src/modules/compras/instructivo-embalaje/instructivo-embalaje.service.js'
import {
  crearOrdenCompra as crearOrdenCompraSvc,
  actualizarOrdenCompra as actualizarOrdenCompraSvc,
  eliminarOrdenCompra as eliminarOrdenCompraSvc,
  obtenerOrdenCompra as obtenerOrdenCompraSvc,
  agregarLinea as agregarLineaSvc,
  actualizarLinea as actualizarLineaSvc,
  obtenerDisponibilidadCierre as obtenerDisponibilidadCierreSvc,
} from '../../src/modules/compras/ordenes-compra/ordenes-compra.service.js'
import {
  crearSolicitud as crearSolicitudSvc,
  notificarSolicitud as notificarSolicitudSvc,
  cerrarSolicitud as cerrarSolicitudSvc,
} from '../../src/modules/calidad/solicitudes/solicitudes.service.js'
import type { NotaVentaCreateInput, NotaVentaUpdateInput, NotaVentaDetalleCreateInput } from '../../src/modules/ventas/notas-venta/notas-venta.types.js'
import type { InstructivoEmbalajeCreateInput } from '../../src/modules/compras/instructivo-embalaje/instructivo-embalaje.types.js'
import type {
  OrdenCompraCreateInput,
  OrdenCompraUpdateInput,
  OrdenCompraLineaCreateInput,
  OrdenCompraLineaUpdateInput,
} from '../../src/modules/compras/ordenes-compra/ordenes-compra.types.js'
import type { SolicitudCreateBody } from '../../src/modules/calidad/solicitudes/solicitudes.schema.js'

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
async function actualizarDetalleNV(empresaId: number, notaVentaId: number, detalleId: number, body: NotaVentaDetalleCreateInput) {
  return empresaContext.run({ empresaId }, () => actualizarDetalleSvc(notaVentaId, detalleId, body))
}
async function eliminarDetalleNV(empresaId: number, notaVentaId: number, detalleId: number) {
  return empresaContext.run({ empresaId }, () => eliminarDetalleSvc(notaVentaId, detalleId))
}
async function listarNotasVenta(empresaId: number) {
  return empresaContext.run({ empresaId }, () => listarNotasVentaSvc(1, 20))
}

// OrdenCompra es por-empresa desde Fase 3 (lote Compras) — createOrdenCompra
// usa prisma.$transaction() internamente, mismo caso que NotaVenta arriba:
// se envuelve proactivamente en `.run()` en vez de depender del beforeEach
// compartido (enterWith), aplicando la lección del lote Ventas antes de que
// Codex tuviera que encontrarla de nuevo.
async function crearOrdenCompra(empresaId: number, body: OrdenCompraCreateInput, userId: string) {
  return empresaContext.run({ empresaId }, () => crearOrdenCompraSvc(body, userId))
}
async function actualizarOrdenCompra(empresaId: number, id: number, body: OrdenCompraUpdateInput, userId: string) {
  return empresaContext.run({ empresaId }, () => actualizarOrdenCompraSvc(id, body, userId))
}
async function eliminarOrdenCompra(empresaId: number, id: number, userId: string) {
  return empresaContext.run({ empresaId }, () => eliminarOrdenCompraSvc(id, userId))
}
async function obtenerOrdenCompra(empresaId: number, id: number) {
  return empresaContext.run({ empresaId }, () => obtenerOrdenCompraSvc(id))
}
async function agregarLinea(empresaId: number, ordenCompraId: number, body: OrdenCompraLineaCreateInput) {
  return empresaContext.run({ empresaId }, () => agregarLineaSvc(ordenCompraId, body))
}
async function actualizarLinea(empresaId: number, ordenCompraId: number, lineaId: number, body: OrdenCompraLineaUpdateInput) {
  return empresaContext.run({ empresaId }, () => actualizarLineaSvc(ordenCompraId, lineaId, body))
}
async function obtenerDisponibilidadCierre(empresaId: number, notaVentaId: number) {
  return empresaContext.run({ empresaId }, () => obtenerDisponibilidadCierreSvc(notaVentaId))
}

// SolicitudInspeccion: la OC exige una Aprobada de tipo Compra (compras.md
// §4.2) — se crea/notifica/cierra una en `crearFixtures()` para que los
// tests de OC de este archivo puedan referenciarla.
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
      "alturas",
      "calibres",
      "categorias",
      "variedades",
      "grupos_variedad",
      "especies",
      "mercados",
      "grupos_mercado",
      "monedas",
      "tipos_embarque",
      "temporadas",
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

async function crearCondicionPago(empresaId: number, cuotas: { porcentaje: number; plazoDias: number }[]) {
  return prisma.condicionPago.create({
    data: {
      empresaId,
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
  const altura = await prisma.altura.create({ data: { empresaId: empresa.id, codigo: 'ALT-1', descripcion: 'Altura 1', creadoPor: 'test' } })

  // La OC exige una Inspección de Compra Aprobada del mismo productor
  // (compras.md §4.2) — se crea, notifica y cierra (APROBADA) una acá para
  // que los tests de OC de este archivo la referencien.
  const perfilInspector = await prisma.perfil.create({ data: { codigo: 'PERFIL-INSPECTOR', descripcion: 'Inspector', creadoPor: 'test' } })
  const usuarioInspector = await prisma.usuario.create({
    data: { id: 'usuario-inspector', nombre: 'Usuario Inspector', email: 'inspector@example.invalid', perfilId: perfilInspector.id, creadoPor: 'test' },
  })
  const temporada = await prisma.temporada.create({
    data: { empresaId: empresa.id, codigo: 'TEMP-1', descripcion: 'Temporada 1', fechaInicio: new Date('2026-01-01'), fechaTermino: new Date('2026-12-31'), creadoPor: 'test' },
  })
  const direccionProductor = await prisma.entidadDireccion.create({
    data: { entidadId: productor.id, codigo: 'DIR-1', descripcion: 'Predio', paisId: pais.id, direccion: 'Camino Rural s/n', creadoPor: 'test' },
  })
  const solicitudCreada = await crearSolicitudInspeccion(empresa.id, {
    temporadaId: temporada.id,
    usuarioSolicitanteId: usuarioInspector.id,
    entidadProductorId: productor.id,
    direccionId: direccionProductor.id,
    fechaHora: new Date('2026-08-01T15:00:00Z').toISOString(),
    asignados: [{ usuarioId: usuarioInspector.id, funcion: 'ACUDIR' }],
  }, 'test')
  await notificarSolicitudInspeccion(empresa.id, solicitudCreada.id, 'test')
  const solicitudInspeccionCompraAprobada = await cerrarSolicitudInspeccion(empresa.id, solicitudCreada.id, 'APROBADA', 'test')

  return {
    empresa, pais, cliente, productor, tipoEmbarque, mercado, grupoMercado, moneda, especie, variedad, categoria,
    calibreChico, calibreGrande, articulo, altura, solicitudInspeccionCompraAprobada,
    // Expuestos para crearOtraSolicitudAprobada (Etapa 2, N:M OC↔Solicitud):
    // cada Solicitud solo puede vincularse a una OC, así que los tests que
    // crean más de una OC dentro del mismo `f` necesitan poder generar una
    // segunda Solicitud Aprobada reutilizando el mismo productor/temporada.
    temporada, direccionProductor, usuarioInspector,
  }
}

async function crearOtraSolicitudAprobada(f: Awaited<ReturnType<typeof crearFixtures>>) {
  const solicitud = await crearSolicitudInspeccion(f.empresa.id, {
    temporadaId: f.temporada.id,
    usuarioSolicitanteId: f.usuarioInspector.id,
    entidadProductorId: f.productor.id,
    direccionId: f.direccionProductor.id,
    fechaHora: new Date('2026-08-02T15:00:00Z').toISOString(),
    asignados: [{ usuarioId: f.usuarioInspector.id, funcion: 'ACUDIR' }],
  }, 'test')
  await notificarSolicitudInspeccion(f.empresa.id, solicitud.id, 'test')
  return cerrarSolicitudInspeccion(f.empresa.id, solicitud.id, 'APROBADA', 'test')
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

  it('crea un Instructivo de Embalaje con lista de calibres (compras.md §4.3/§6.5)', async () => {
    const f = await crearFixtures()
    const nv = await crearNotaVenta(f.empresa.id, nvBase(f), 'test')

    const instructivo = await crearInstructivo(f.empresa.id, {
      entidadProductorId: f.productor.id,
      grupoMercadoId: f.grupoMercado.id,
      fechaInicioPrograma: new Date('2026-08-01'),
      detalle: [{
        articuloId: f.articulo.id,
        especieId: f.especie.id,
        variedadId: f.variedad.id,
        categoriaId: f.categoria.id,
        calibreIds: [f.calibreChico.id, f.calibreGrande.id],
        alturaId: f.altura.id,
        cantidadPallets: 1,
        cajasPorPallet: 1,
        cajas: 1,
      }],
    }, 'test')
    expect(instructivo.numero).toBe(1)
  })

  it('el Instructivo de Embalaje NO bloquea la edición ni el borrado de la Nota de Venta (decisión de negocio)', async () => {
    const f = await crearFixtures()
    const nv = await crearNotaVenta(f.empresa.id, nvBase(f), 'test')
    await crearInstructivo(f.empresa.id, {
      entidadProductorId: f.productor.id,
      grupoMercadoId: f.grupoMercado.id,
      fechaInicioPrograma: new Date('2026-08-01'),
      detalle: [{
        articuloId: f.articulo.id,
        especieId: f.especie.id,
        variedadId: f.variedad.id,
        categoriaId: f.categoria.id,
        calibreIds: [f.calibreChico.id, f.calibreGrande.id],
        alturaId: f.altura.id,
        cantidadPallets: 1,
        cajasPorPallet: 1,
        cajas: 1,
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
      calibreIds: [f.calibreChico.id, f.calibreGrande.id],
      cantidadPallets: 40,
      cajasPorPallet: 114,
      cajas: 40 * 114,
      precioUsdCaja: 8.5,
    }
  }

  it('genera correlativo OC-{año}-{NNNN} y rechaza productor sin tipo Productor', async () => {
    const f = await crearFixtures()
    // N:M (Etapa 2): cada Solicitud solo puede vincularse a una OC, así que
    // oc2 necesita su propia Solicitud Aprobada distinta de la de oc1.
    const solicitud2 = await crearOtraSolicitudAprobada(f)
    const oc1 = await crearOrdenCompra(f.empresa.id, { entidadProductorId: f.productor.id, solicitudInspeccionIds: [f.solicitudInspeccionCompraAprobada.id], monedaId: f.moneda.id }, 'test')
    const oc2 = await crearOrdenCompra(f.empresa.id, { entidadProductorId: f.productor.id, solicitudInspeccionIds: [solicitud2.id], monedaId: f.moneda.id }, 'test')
    const anio = new Date().getFullYear()
    expect(oc1.numero).toBe(`OC-${anio}-0001`)
    expect(oc2.numero).toBe(`OC-${anio}-0002`)

    // Rechazada por productor distinto — falla antes de llegar a revalidar
    // que la Solicitud ya esté vinculada a oc1, así que puede reutilizarla.
    await expect(
      crearOrdenCompra(f.empresa.id, { entidadProductorId: f.cliente.id, solicitudInspeccionIds: [f.solicitudInspeccionCompraAprobada.id], monedaId: f.moneda.id }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('deriva las cuotas de pago desde la Condición de Pago seleccionada (no se cargan manualmente) y valida la lista de calibres por especie al agregar una línea', async () => {
    const f = await crearFixtures()
    const condicionPago = await crearCondicionPago(f.empresa.id, [
      { porcentaje: 80, plazoDias: 30, descripcion: 'Anticipo' },
      { porcentaje: 20, plazoDias: 60, descripcion: 'Saldo' },
    ])

    const ocCreada = await crearOrdenCompra(f.empresa.id, {
      entidadProductorId: f.productor.id,
      solicitudInspeccionIds: [f.solicitudInspeccionCompraAprobada.id],
      monedaId: f.moneda.id,
      condicionPagoId: condicionPago.id,
    }, 'test')
    await agregarLinea(f.empresa.id, ocCreada.id, ocLinea(f))
    const oc = await obtenerOrdenCompra(f.empresa.id, ocCreada.id)
    expect(oc.cuotasPago).toHaveLength(2)
    expect(oc.cuotasPago.map((c) => Number(c.porcentaje)).sort()).toEqual([20, 80])
    expect(oc.lineas).toHaveLength(1)

    // Sin condición de pago no hay cuotas (no quedan pendientes de carga
    // manual) — segunda OC, necesita su propia Solicitud (N:M, Etapa 2).
    const solicitud2 = await crearOtraSolicitudAprobada(f)
    const ocSinCuotas = await crearOrdenCompra(f.empresa.id, { entidadProductorId: f.productor.id, solicitudInspeccionIds: [solicitud2.id], monedaId: f.moneda.id }, 'test')
    expect(ocSinCuotas.cuotasPago).toHaveLength(0)
  })

  it('permite agregar y editar líneas de una OC en Borrador', async () => {
    const f = await crearFixtures()
    const oc = await crearOrdenCompra(f.empresa.id, { entidadProductorId: f.productor.id, solicitudInspeccionIds: [f.solicitudInspeccionCompraAprobada.id], monedaId: f.moneda.id }, 'test')
    expect(oc.estado).toBe('BORRADOR')

    const linea = await agregarLinea(f.empresa.id, oc.id, ocLinea(f))
    await actualizarLinea(f.empresa.id, oc.id, linea.id, { ...ocLinea(f), cantidadPallets: 50 })
    const editada = await actualizarOrdenCompra(f.empresa.id, oc.id, { estado: 'EMITIDA' }, 'test')

    expect(editada.estado).toBe('EMITIDA')
    expect(editada.lineas).toHaveLength(1)
    expect(editada.lineas[0].cantidadPallets).toBe(50)
  })

  it('rechaza notaVentaId, destinoMercadoId, condicionPagoId y responsableId inexistentes o inválidos', async () => {
    const f = await crearFixtures()
    const usuarioSinFlag = await crearUsuarioResponsable(false, 'no-resp')

    await expect(
      crearOrdenCompra(f.empresa.id, { entidadProductorId: f.productor.id, solicitudInspeccionIds: [f.solicitudInspeccionCompraAprobada.id], monedaId: f.moneda.id, notaVentaId: 999999 }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })

    await expect(
      crearOrdenCompra(f.empresa.id, { entidadProductorId: f.productor.id, solicitudInspeccionIds: [f.solicitudInspeccionCompraAprobada.id], monedaId: f.moneda.id, destinoMercadoId: 999999 }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })

    await expect(
      crearOrdenCompra(f.empresa.id, { entidadProductorId: f.productor.id, solicitudInspeccionIds: [f.solicitudInspeccionCompraAprobada.id], monedaId: f.moneda.id, condicionPagoId: 999999 }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })

    await expect(
      crearOrdenCompra(f.empresa.id, { entidadProductorId: f.productor.id, solicitudInspeccionIds: [f.solicitudInspeccionCompraAprobada.id], monedaId: f.moneda.id, formaPagoId: 999999 }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })

    // Solo usuarios marcados como Responsable de Venta pueden asignarse
    await expect(
      crearOrdenCompra(f.empresa.id, { entidadProductorId: f.productor.id, solicitudInspeccionIds: [f.solicitudInspeccionCompraAprobada.id], monedaId: f.moneda.id, responsableId: usuarioSinFlag.id }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })

    const usuarioResponsable = await crearUsuarioResponsable(true, 'si-resp')
    const oc = await crearOrdenCompra(f.empresa.id, {
      entidadProductorId: f.productor.id,
      solicitudInspeccionIds: [f.solicitudInspeccionCompraAprobada.id],
      monedaId: f.moneda.id,
      destinoMercadoId: f.mercado.id,
      responsableId: usuarioResponsable.id,
    }, 'test')
    expect(oc.destinoMercado?.id).toBe(f.mercado.id)
    expect(oc.responsable?.id).toBe(usuarioResponsable.id)
  })

  it('permite eliminar (soft delete) una OC en Borrador/Emitida, pero bloquea edición, eliminación y edición de líneas tras Recepcionada', async () => {
    const f = await crearFixtures()
    const oc = await crearOrdenCompra(f.empresa.id, { entidadProductorId: f.productor.id, solicitudInspeccionIds: [f.solicitudInspeccionCompraAprobada.id], monedaId: f.moneda.id }, 'test')

    await eliminarOrdenCompra(f.empresa.id, oc.id, 'test')
    await expect(obtenerOrdenCompra(f.empresa.id, oc.id)).rejects.toMatchObject({ statusCode: 404 })

    // Simula el estado que en el futuro solo asignará el flujo de Recepción
    // (compras.md §4.4/§8) — no seteable manualmente vía la API (OC-001).
    const oc2 = await crearOrdenCompra(f.empresa.id, { entidadProductorId: f.productor.id, solicitudInspeccionIds: [f.solicitudInspeccionCompraAprobada.id], monedaId: f.moneda.id }, 'test')
    const linea2 = await agregarLinea(f.empresa.id, oc2.id, ocLinea(f))
    await prisma.ordenCompra.update({ where: { id: oc2.id }, data: { estado: 'RECEPCIONADA' } })

    await expect(
      actualizarOrdenCompra(f.empresa.id, oc2.id, { observaciones: 'no debería aplicar' }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })
    await expect(eliminarOrdenCompra(f.empresa.id, oc2.id, 'test')).rejects.toMatchObject({ statusCode: 422 })
    await expect(agregarLinea(f.empresa.id, oc2.id, ocLinea(f))).rejects.toMatchObject({ statusCode: 422 })
    await expect(actualizarLinea(f.empresa.id, oc2.id, linea2.id, ocLinea(f))).rejects.toMatchObject({ statusCode: 422 })
  })
})

describe('Orden de Compra ↔ Cierre Comercial: línea tomada de una línea del Cierre (2026-08-23)', () => {
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
      calibreIds: [f.calibreChico.id, f.calibreGrande.id],
      cantidadPallets: 40,
      cajasPorPallet: 114,
      cajas: 40 * 114,
      precioUsdCaja: 8.5,
    }
  }

  // Cierre con una única línea de detalle (4 pallets x 114 = 456 cajas, ambos
  // calibres de fixtures) — base para los tests de esta sección.
  async function crearCierreConDetalle(f: Awaited<ReturnType<typeof crearFixtures>>, overrides: Partial<NotaVentaDetalleCreateInput> = {}) {
    const nv = await crearNotaVenta(f.empresa.id, nvBase(f), 'test')
    const detalle = await agregarDetalle(f.empresa.id, nv.id, {
      fechaCompromiso: new Date(),
      especieId: f.especie.id,
      variedadId: f.variedad.id,
      articuloId: f.articulo.id,
      categoriaId: f.categoria.id,
      cantidadPallets: 4,
      cajasPorPallet: 114,
      cajas: 456,
      precio: 12,
      calibreIds: [f.calibreChico.id, f.calibreGrande.id],
      ...overrides,
    })
    return { nv, detalle }
  }

  it('toma una línea completa del Cierre: copia especie/variedad/categoría/artículo server-side e ignora lo que mande el cliente', async () => {
    const f = await crearFixtures()
    const { nv, detalle } = await crearCierreConDetalle(f)
    const oc = await crearOrdenCompra(f.empresa.id, {
      entidadProductorId: f.productor.id,
      notaVentaId: nv.id,
      solicitudInspeccionIds: [f.solicitudInspeccionCompraAprobada.id],
      monedaId: f.moneda.id,
    }, 'test')

    // especieId/variedadId/categoriaId/articuloId son basura deliberada (ids
    // inexistentes) — la fuente de verdad es la línea del Cierre, no lo que
    // mande el cliente (FAS-OCNV-001/004); si el server los usara en vez de
    // sobreescribirlos, validarLinea los rechazaría igual por no existir.
    const linea = await agregarLinea(f.empresa.id, oc.id, {
      ...ocLinea(f),
      especieId: 999999,
      variedadId: 999999,
      categoriaId: 999999,
      articuloId: 999999,
      calibreIds: [f.calibreChico.id],
      cantidadPallets: 4,
      cajas: detalle.cajas,
      notaVentaDetalleId: detalle.id,
    })

    expect(linea.especieId).toBe(f.especie.id)
    expect(linea.variedadId).toBe(f.variedad.id)
    expect(linea.categoriaId).toBe(f.categoria.id)
    expect(linea.articuloId).toBe(f.articulo.id)
    expect(linea.notaVentaDetalleId).toBe(detalle.id)
    expect(linea.calibres.map((c) => c.calibre.id)).toEqual([f.calibreChico.id])
  })

  it('reparte una línea del Cierre entre dos OC sin superar el disponible, y refleja estadoOc/disponibilidad', async () => {
    const f = await crearFixtures()
    const { nv, detalle } = await crearCierreConDetalle(f) // 456 cajas

    const oc1 = await crearOrdenCompra(f.empresa.id, {
      entidadProductorId: f.productor.id,
      notaVentaId: nv.id,
      solicitudInspeccionIds: [f.solicitudInspeccionCompraAprobada.id],
      monedaId: f.moneda.id,
    }, 'test')
    const linea1 = await agregarLinea(f.empresa.id, oc1.id, {
      ...ocLinea(f), cantidadPallets: 2, cajas: 228, notaVentaDetalleId: detalle.id,
    })
    expect(linea1.cajas).toBe(228)

    const listado1 = await listarNotasVenta(f.empresa.id)
    expect(listado1.data.find((n) => n.id === nv.id)?.estadoOc).toBe('PENDIENTE')
    const disponibilidad1 = await obtenerDisponibilidadCierre(f.empresa.id, nv.id)
    expect(disponibilidad1.find((d) => d.id === detalle.id)?.cajasDisponibles).toBe(228)

    const solicitud2 = await crearOtraSolicitudAprobada(f)
    const oc2 = await crearOrdenCompra(f.empresa.id, {
      entidadProductorId: f.productor.id,
      notaVentaId: nv.id,
      solicitudInspeccionIds: [solicitud2.id],
      monedaId: f.moneda.id,
    }, 'test')
    const linea2 = await agregarLinea(f.empresa.id, oc2.id, {
      ...ocLinea(f), cantidadPallets: 2, cajas: 228, notaVentaDetalleId: detalle.id,
    })
    expect(linea2.cajas).toBe(228)

    const listado2 = await listarNotasVenta(f.empresa.id)
    expect(listado2.data.find((n) => n.id === nv.id)?.estadoOc).toBe('COMPLETA')
    const disponibilidad2 = await obtenerDisponibilidadCierre(f.empresa.id, nv.id)
    expect(disponibilidad2.find((d) => d.id === detalle.id)?.cajasDisponibles).toBe(0)

    // Sin disponible: una tercera OC no puede tomar ni una caja más de esta línea.
    const solicitud3 = await crearOtraSolicitudAprobada(f)
    const oc3 = await crearOrdenCompra(f.empresa.id, {
      entidadProductorId: f.productor.id,
      notaVentaId: nv.id,
      solicitudInspeccionIds: [solicitud3.id],
      monedaId: f.moneda.id,
    }, 'test')
    await expect(
      agregarLinea(f.empresa.id, oc3.id, { ...ocLinea(f), cantidadPallets: 1, cajas: 1, notaVentaDetalleId: detalle.id }),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('libera el disponible de la línea del Cierre al eliminar (soft delete) la OC que la comprometía', async () => {
    const f = await crearFixtures()
    const { nv, detalle } = await crearCierreConDetalle(f) // 456 cajas
    const oc1 = await crearOrdenCompra(f.empresa.id, {
      entidadProductorId: f.productor.id,
      notaVentaId: nv.id,
      solicitudInspeccionIds: [f.solicitudInspeccionCompraAprobada.id],
      monedaId: f.moneda.id,
    }, 'test')
    await agregarLinea(f.empresa.id, oc1.id, { ...ocLinea(f), cantidadPallets: 2, cajas: 228, notaVentaDetalleId: detalle.id })

    const antes = await obtenerDisponibilidadCierre(f.empresa.id, nv.id)
    expect(antes.find((d) => d.id === detalle.id)?.cajasDisponibles).toBe(228)

    await eliminarOrdenCompra(f.empresa.id, oc1.id, 'test')

    // La OC eliminada ya no cuenta como comprometido (ordenCompra.eliminadoEn
    // filtrado en getCajasComprometidas/groupBy) — el disponible vuelve a 456.
    const despues = await obtenerDisponibilidadCierre(f.empresa.id, nv.id)
    expect(despues.find((d) => d.id === detalle.id)?.cajasDisponibles).toBe(456)
    const listado = await listarNotasVenta(f.empresa.id)
    expect(listado.data.find((n) => n.id === nv.id)?.estadoOc).toBe('PENDIENTE')

    // Y ese cupo liberado es realmente usable por otra OC, no solo un número.
    const solicitud2 = await crearOtraSolicitudAprobada(f)
    const oc2 = await crearOrdenCompra(f.empresa.id, {
      entidadProductorId: f.productor.id,
      notaVentaId: nv.id,
      solicitudInspeccionIds: [solicitud2.id],
      monedaId: f.moneda.id,
    }, 'test')
    const linea2 = await agregarLinea(f.empresa.id, oc2.id, {
      ...ocLinea(f), cantidadPallets: 4, cajas: 456, notaVentaDetalleId: detalle.id,
    })
    expect(linea2.cajas).toBe(456)
  })

  it('rechaza calibres que no están en la lista de la línea del Cierre', async () => {
    const f = await crearFixtures()
    const { nv, detalle } = await crearCierreConDetalle(f, { calibreIds: [f.calibreChico.id] })
    const oc = await crearOrdenCompra(f.empresa.id, {
      entidadProductorId: f.productor.id,
      notaVentaId: nv.id,
      solicitudInspeccionIds: [f.solicitudInspeccionCompraAprobada.id],
      monedaId: f.moneda.id,
    }, 'test')

    await expect(
      agregarLinea(f.empresa.id, oc.id, { ...ocLinea(f), calibreIds: [f.calibreGrande.id], cajas: 456, notaVentaDetalleId: detalle.id }),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('rechaza una línea de Cierre que no pertenece al Cierre Comercial de la OC', async () => {
    const f = await crearFixtures()
    const { nv: nvPropio } = await crearCierreConDetalle(f)
    const { detalle: detalleAjeno } = await crearCierreConDetalle(f)
    const oc = await crearOrdenCompra(f.empresa.id, {
      entidadProductorId: f.productor.id,
      notaVentaId: nvPropio.id,
      solicitudInspeccionIds: [f.solicitudInspeccionCompraAprobada.id],
      monedaId: f.moneda.id,
    }, 'test')

    await expect(
      agregarLinea(f.empresa.id, oc.id, { ...ocLinea(f), cajas: 100, notaVentaDetalleId: detalleAjeno.id }),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('rechaza tomar una línea del Cierre sin categoría definida', async () => {
    const f = await crearFixtures()
    const nv = await crearNotaVenta(f.empresa.id, nvBase(f), 'test')
    const detalleSinCategoria = await agregarDetalle(f.empresa.id, nv.id, {
      fechaCompromiso: new Date(),
      especieId: f.especie.id,
      variedadId: f.variedad.id,
      articuloId: f.articulo.id,
      cantidadPallets: 4,
      cajasPorPallet: 114,
      cajas: 456,
      precio: 12,
      calibreIds: [f.calibreChico.id, f.calibreGrande.id],
    })
    expect(detalleSinCategoria.categoriaId).toBeNull()

    const oc = await crearOrdenCompra(f.empresa.id, {
      entidadProductorId: f.productor.id,
      notaVentaId: nv.id,
      solicitudInspeccionIds: [f.solicitudInspeccionCompraAprobada.id],
      monedaId: f.moneda.id,
    }, 'test')

    await expect(
      agregarLinea(f.empresa.id, oc.id, { ...ocLinea(f), cajas: 456, notaVentaDetalleId: detalleSinCategoria.id }),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('bloquea eliminar y editar identidad de una línea del Cierre con cajas comprometidas; permite subir cajas pero no bajarlas del comprometido', async () => {
    const f = await crearFixtures()
    const { nv, detalle } = await crearCierreConDetalle(f)
    const oc = await crearOrdenCompra(f.empresa.id, {
      entidadProductorId: f.productor.id,
      notaVentaId: nv.id,
      solicitudInspeccionIds: [f.solicitudInspeccionCompraAprobada.id],
      monedaId: f.moneda.id,
    }, 'test')
    await agregarLinea(f.empresa.id, oc.id, { ...ocLinea(f), cantidadPallets: 2, cajas: 228, notaVentaDetalleId: detalle.id })

    await expect(eliminarDetalleNV(f.empresa.id, nv.id, detalle.id)).rejects.toMatchObject({ statusCode: 422 })

    const detalleBase: NotaVentaDetalleCreateInput = {
      fechaCompromiso: new Date(),
      especieId: f.especie.id,
      variedadId: f.variedad.id,
      articuloId: f.articulo.id,
      categoriaId: f.categoria.id,
      cantidadPallets: 4,
      cajasPorPallet: 114,
      cajas: 456,
      precio: 12,
      calibreIds: [f.calibreChico.id, f.calibreGrande.id],
    }

    const otraEspecie = await prisma.especie.create({ data: { empresaId: f.empresa.id, codigo: 'CZ2', descripcion: 'Cereza', creadoPor: 'test' } })
    await expect(
      actualizarDetalleNV(f.empresa.id, nv.id, detalle.id, { ...detalleBase, especieId: otraEspecie.id }),
    ).rejects.toMatchObject({ statusCode: 422 })

    await expect(
      actualizarDetalleNV(f.empresa.id, nv.id, detalle.id, { ...detalleBase, cajas: 100 }),
    ).rejects.toMatchObject({ statusCode: 422 })

    const actualizado = await actualizarDetalleNV(f.empresa.id, nv.id, detalle.id, { ...detalleBase, cajas: 500 })
    expect(actualizado.cajas).toBe(500)
  })

  it('bloquea cambiar o quitar el Cierre Comercial de una OC que ya tiene líneas tomadas de él', async () => {
    const f = await crearFixtures()
    const { nv, detalle } = await crearCierreConDetalle(f)
    const { nv: otroNv } = await crearCierreConDetalle(f)
    const oc = await crearOrdenCompra(f.empresa.id, {
      entidadProductorId: f.productor.id,
      notaVentaId: nv.id,
      solicitudInspeccionIds: [f.solicitudInspeccionCompraAprobada.id],
      monedaId: f.moneda.id,
    }, 'test')
    await agregarLinea(f.empresa.id, oc.id, { ...ocLinea(f), cantidadPallets: 1, cajas: 114, notaVentaDetalleId: detalle.id })

    await expect(
      actualizarOrdenCompra(f.empresa.id, oc.id, { notaVentaId: otroNv.id }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })
    await expect(
      actualizarOrdenCompra(f.empresa.id, oc.id, { notaVentaId: null }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })
  })
})
