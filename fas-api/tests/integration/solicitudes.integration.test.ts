import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma.js'
import { empresaContext } from '../../src/lib/empresa-context.js'
import {
  crearSolicitud as crearSolicitudSvc,
  actualizarSolicitud as actualizarSolicitudSvc,
  obtenerSolicitud as obtenerSolicitudSvc,
} from '../../src/modules/calidad/solicitudes/solicitudes.service.js'
import { eliminarMantenedor as eliminarMantenedorSvc } from '../../src/modules/config/config.service.js'
import type { SolicitudCreateBody, SolicitudUpdateBody } from '../../src/modules/calidad/solicitudes/solicitudes.schema.js'
import type { MantenedorModelo } from '../../src/modules/config/config.types.js'

// SolicitudInspeccion es por-empresa desde Fase 3 (lote Calidad) — los
// servicios que la tocan necesitan contexto ALS, que fuera de un request HTTP
// no existe por defecto. A diferencia del patrón `enterWith` en `beforeEach`
// usado en otros archivos (frágil: no se propaga de forma confiable entre el
// hook y el cuerpo del test, ver lote Entidades/Fase 3), cada llamada de
// servicio en este archivo se envuelve individualmente en `.run()`.
async function crearSolicitud(empresaId: number, body: SolicitudCreateBody, userId: string) {
  return empresaContext.run({ empresaId }, () => crearSolicitudSvc(body, userId))
}
async function actualizarSolicitud(empresaId: number, id: number, body: SolicitudUpdateBody, userId: string) {
  return empresaContext.run({ empresaId }, () => actualizarSolicitudSvc(id, body, userId))
}
async function obtenerSolicitud(empresaId: number, id: number) {
  return empresaContext.run({ empresaId }, () => obtenerSolicitudSvc(id))
}
async function eliminarMantenedor(empresaId: number, modelo: MantenedorModelo, id: number) {
  return empresaContext.run({ empresaId }, () => eliminarMantenedorSvc(modelo, id))
}
async function eliminarEntidad(empresaId: number, id: number, userId: string) {
  const { eliminarEntidad: eliminarEntidadSvc } = await import('../../src/modules/config/entidades/entidades.service.js')
  return empresaContext.run({ empresaId }, () => eliminarEntidadSvc(id, userId))
}

const databaseName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1)
if (databaseName !== 'fas_test') {
  throw new Error(`Seguridad: las pruebas de Solicitudes requieren fas_test; recibido "${databaseName}"`)
}

async function limpiarDatos() {
  // Detalle por línea (2026-10-27): el TRUNCATE de solicitudes_inspeccion
  // cascada a líneas y sus hijas, pero se listan explícitas por claridad.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "solicitud_inspeccion_linea_categorias",
      "solicitud_inspeccion_linea_calibres",
      "solicitud_inspeccion_linea_calidades",
      "solicitud_inspeccion_lineas",
      "solicitud_inspeccion_paises",
      "solicitud_inspeccion_asignados",
      "solicitudes_inspeccion",
      "articulos",
      "calibres",
      "categorias",
      "variedades",
      "grupos_variedad",
      "especies",
      "mercados",
      "grupos_mercado",
      "temporadas",
      "entidad_direcciones",
      "entidades",
      "paises",
      "usuarios",
      "perfiles",
      "unidades_medida"
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

async function crearFixtures() {
  const empresa = await obtenerEmpresaTest()
  const grupoMercado = await prisma.grupoMercado.create({ data: { empresaId: empresa.id, codigo: 'GM1', descripcion: 'Grupo 1', creadoPor: 'test' } })
  const mercado = await prisma.mercado.create({ data: { empresaId: empresa.id, codigo: 'MK1', descripcion: 'Mercado 1', grupoMercadoId: grupoMercado.id, creadoPor: 'test' } })
  const chile = await prisma.pais.create({ data: { codigo: 'CHL', descripcion: 'Chile', esPaisNacional: true, puedeSerOrigen: true, creadoPor: 'test' } })
  const usa = await prisma.pais.create({ data: { codigo: 'USA', descripcion: 'Estados Unidos', creadoPor: 'test' } })
  await prisma.mercadoPais.createMany({
    data: [
      { empresaId: empresa.id, mercadoId: mercado.id, paisId: chile.id, creadoPor: 'test' },
      { empresaId: empresa.id, mercadoId: mercado.id, paisId: usa.id, creadoPor: 'test' },
    ],
  })

  const productor = await prisma.entidad.create({
    data: { empresaId: empresa.id, codigo: 'PROD-01', descripcion: 'Productor Uno', razonSocial: 'Productor Uno SpA', paisId: chile.id, tipos: ['PRODUCTOR'], creadoPor: 'test' },
  })
  const direccion = await prisma.entidadDireccion.create({
    data: { entidadId: productor.id, codigo: 'D1', descripcion: 'Predio principal', paisId: chile.id, direccion: 'Camino Interior 123', creadoPor: 'test' },
  })
  const clienteExtranjero = await prisma.entidad.create({
    data: { empresaId: empresa.id, codigo: 'CLI-EXT', descripcion: 'Cliente USA', razonSocial: 'Cliente USA Inc', paisId: usa.id, tipos: ['CLIENTE_EXTRANJERO'], creadoPor: 'test' },
  })
  const clienteNoExtranjero = await prisma.entidad.create({
    data: { empresaId: empresa.id, codigo: 'CLI-NAC', descripcion: 'Cliente Nacional', razonSocial: 'Cliente Nacional SpA', paisId: chile.id, tipos: ['CLIENTE_NACIONAL'], creadoPor: 'test' },
  })

  const temporada = await prisma.temporada.create({
    data: { empresaId: empresa.id, codigo: 'T26', descripcion: 'Temporada 2026', fechaInicio: new Date('2026-01-01'), fechaTermino: new Date('2026-12-31'), creadoPor: 'test' },
  })
  const especie = await prisma.especie.create({ data: { empresaId: empresa.id, codigo: 'UV', descripcion: 'Uva', creadoPor: 'test' } })
  const otraEspecie = await prisma.especie.create({ data: { empresaId: empresa.id, codigo: 'CZ', descripcion: 'Cereza', creadoPor: 'test' } })
  const grupoVariedad = await prisma.grupoVariedad.create({ data: { empresaId: empresa.id, codigo: 'GV-UV', descripcion: 'Uva de Mesa', especieId: especie.id, creadoPor: 'test' } })
  const grupoVariedadOtraEspecie = await prisma.grupoVariedad.create({ data: { empresaId: empresa.id, codigo: 'GV-CZ', descripcion: 'Cereza', especieId: otraEspecie.id, creadoPor: 'test' } })
  const variedad = await prisma.variedad.create({ data: { empresaId: empresa.id, codigo: 'RG', descripcion: 'Red Globe', especieId: especie.id, grupoVariedadId: grupoVariedad.id, creadoPor: 'test' } })
  const variedadOtraEspecie = await prisma.variedad.create({ data: { empresaId: empresa.id, codigo: 'BING', descripcion: 'Bing', especieId: otraEspecie.id, grupoVariedadId: grupoVariedadOtraEspecie.id, creadoPor: 'test' } })
  const calibre = await prisma.calibre.create({ data: { empresaId: empresa.id, codigo: 'XL', descripcion: 'XL', especieId: especie.id, orden: 1, control: [], creadoPor: 'test' } })
  const categoria = await prisma.categoria.create({ data: { empresaId: empresa.id, codigo: 'CAT1', descripcion: 'Categoría 1', especieId: especie.id, orden: 1, control: [], creadoPor: 'test' } })

  const unidad = await prisma.unidadMedida.create({ data: { empresaId: empresa.id, codigo: 'CAJA', descripcion: 'Caja', creadoPor: 'test' } })
  const embalaje = await prisma.articulo.create({
    data: { empresaId: empresa.id, tipo: 'EMBALAJE', codigo: 'ART-EMB', descripcion: 'Caja embalaje', unidadId: unidad.id, tipoCosteo: 'PROMEDIO_PONDERADO' },
  })
  const noEmbalaje = await prisma.articulo.create({
    data: { empresaId: empresa.id, tipo: 'SERVICIO', codigo: 'ART-SERV', descripcion: 'Servicio', unidadId: unidad.id, tipoCosteo: 'PROMEDIO_PONDERADO' },
  })

  const perfil = await prisma.perfil.create({ data: { codigo: 'PERFIL-1', descripcion: 'Perfil de prueba', creadoPor: 'test' } })
  const usuario = await prisma.usuario.create({
    data: { id: 'usuario-1', nombre: 'Usuario Uno', email: 'usuario1@example.invalid', perfilId: perfil.id, creadoPor: 'test' },
  })

  return {
    empresa, chile, usa, productor, direccion, clienteExtranjero, clienteNoExtranjero,
    temporada, especie, otraEspecie, variedad, variedadOtraEspecie, calibre, categoria,
    grupoMercado, mercado, unidad, embalaje, noEmbalaje, usuario,
  }
}

type Fixtures = Awaited<ReturnType<typeof crearFixtures>>

// Línea de producto base (especie Uva + sus variedad/calibre/categoría + embalaje).
function lineaBase(f: Fixtures) {
  return {
    especieId: f.especie.id,
    articuloId: f.embalaje.id,
    variedadId: f.variedad.id,
    categoriaIds: [f.categoria.id],
    calibreIds: [f.calibre.id],
    cantidadPallets: 12,
  }
}

function payloadBase(f: Fixtures): SolicitudCreateBody {
  return {
    temporadaId: f.temporada.id,
    usuarioSolicitanteId: f.usuario.id,
    entidadProductorId: f.productor.id,
    direccionId: f.direccion.id,
    fechaHora: new Date('2026-08-01T15:00:00Z').toISOString(),
    lineas: [lineaBase(f)],
    asignados: [{ usuarioId: f.usuario.id, funcion: 'ACUDIR' as const }],
  }
}

describe('Solicitud de Inspección — cabecera + detalle (especie por línea) contra PostgreSQL', () => {
  beforeEach(limpiarDatos)
  afterAll(async () => {
    await limpiarDatos()
    await prisma.$disconnect()
  })

  it('crea una solicitud con cabecera + una línea de producto y las persiste', async () => {
    const f = await crearFixtures()
    const solicitud = await crearSolicitud(f.empresa.id, {
      ...payloadBase(f),
      mercadoId: f.mercado.id,
      paisIds: [f.usa.id],
      clienteId: f.clienteExtranjero.id,
      fechaDespacho: '2026-09-01',
    }, 'test')

    expect(solicitud.mercadoId).toBe(f.mercado.id)
    expect(solicitud.paises).toHaveLength(1)
    expect(solicitud.clienteId).toBe(f.clienteExtranjero.id)
    expect(solicitud.lineas).toHaveLength(1)
    const linea = solicitud.lineas[0]
    expect(linea.especie.id).toBe(f.especie.id)
    expect(linea.articulo.id).toBe(f.embalaje.id)
    expect(linea.variedad.id).toBe(f.variedad.id)
    expect(linea.cantidadPallets).toBe(12)
    expect(linea.calibres).toHaveLength(1)
    expect(linea.categorias).toHaveLength(1)
  })

  it('acepta múltiples líneas con especies distintas', async () => {
    const f = await crearFixtures()
    const solicitud = await crearSolicitud(f.empresa.id, {
      ...payloadBase(f),
      lineas: [
        lineaBase(f),
        // Segunda especie (Cereza): variedad de su especie, sin calibres/categorías.
        { especieId: f.otraEspecie.id, articuloId: f.embalaje.id, variedadId: f.variedadOtraEspecie.id, categoriaIds: [], calibreIds: [], cantidadPallets: 5 },
      ],
    }, 'test')

    expect(solicitud.lineas).toHaveLength(2)
    const especies = solicitud.lineas.map((l) => l.especie.id).sort()
    expect(especies).toEqual([f.especie.id, f.otraEspecie.id].sort())
  })

  it('exige al menos una línea de producto', async () => {
    const f = await crearFixtures()
    await expect(crearSolicitud(f.empresa.id, { ...payloadBase(f), lineas: [] }, 'test'))
      .rejects.toMatchObject({ statusCode: 422 })
  })

  it('reemplaza por completo las líneas al editar (replace-all)', async () => {
    const f = await crearFixtures()
    const creada = await crearSolicitud(f.empresa.id, { ...payloadBase(f), paisIds: [f.usa.id], mercadoId: f.mercado.id }, 'test')
    expect(creada.lineas[0].calibres).toHaveLength(1)
    expect(creada.lineas[0].categorias).toHaveLength(1)

    const editada = await actualizarSolicitud(f.empresa.id, creada.id, {
      // Una sola línea sin calibres ni categorías.
      lineas: [{ especieId: f.especie.id, articuloId: f.embalaje.id, variedadId: f.variedad.id, categoriaIds: [], calibreIds: [] }],
      paisIds: [],
    }, 'test')

    expect(editada.lineas).toHaveLength(1)
    expect(editada.lineas[0].calibres).toHaveLength(0)
    expect(editada.lineas[0].categorias).toHaveLength(0)
    expect(editada.paises).toHaveLength(0)
  })

  it('no toca las líneas si no vienen en el body de edición', async () => {
    const f = await crearFixtures()
    const creada = await crearSolicitud(f.empresa.id, payloadBase(f), 'test')
    const editada = await actualizarSolicitud(f.empresa.id, creada.id, { observaciones: 'sin tocar líneas' }, 'test')
    expect(editada.lineas).toHaveLength(1)
    expect(editada.lineas[0].variedad.id).toBe(f.variedad.id)
  })

  it('rechaza dejar la solicitud sin líneas al editar', async () => {
    const f = await crearFixtures()
    const creada = await crearSolicitud(f.empresa.id, payloadBase(f), 'test')
    await expect(actualizarSolicitud(f.empresa.id, creada.id, { lineas: [] }, 'test'))
      .rejects.toMatchObject({ statusCode: 422 })
  })

  it('rechaza mercado inexistente y cliente que no es Cliente Extranjero', async () => {
    const f = await crearFixtures()
    await expect(crearSolicitud(f.empresa.id, { ...payloadBase(f), mercadoId: 999999 }, 'test'))
      .rejects.toMatchObject({ statusCode: 422 })
    await expect(crearSolicitud(f.empresa.id, { ...payloadBase(f), clienteId: f.clienteNoExtranjero.id }, 'test'))
      .rejects.toMatchObject({ statusCode: 422 })
  })

  it('QAS-SI-020: rechaza países que no pertenecen al mercado indicado al crear', async () => {
    const f = await crearFixtures()
    const otroMercado = await prisma.mercado.create({
      data: { empresaId: f.empresa.id, codigo: 'MK2', descripcion: 'Mercado 2', grupoMercadoId: f.grupoMercado.id, creadoPor: 'test' },
    })
    await expect(
      crearSolicitud(f.empresa.id, { ...payloadBase(f), mercadoId: otroMercado.id, paisIds: [f.usa.id] }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('QAS-SI-020: rechaza cambiar solo el mercado si los países vigentes pertenecen al anterior', async () => {
    const f = await crearFixtures()
    const creada = await crearSolicitud(f.empresa.id, { ...payloadBase(f), mercadoId: f.mercado.id, paisIds: [f.usa.id] }, 'test')
    const otroMercado = await prisma.mercado.create({
      data: { empresaId: f.empresa.id, codigo: 'MK2', descripcion: 'Mercado 2', grupoMercadoId: f.grupoMercado.id, creadoPor: 'test' },
    })
    await expect(
      actualizarSolicitud(f.empresa.id, creada.id, { mercadoId: otroMercado.id }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('rechaza una línea cuyo embalaje no es artículo tipo EMBALAJE', async () => {
    const f = await crearFixtures()
    await expect(
      crearSolicitud(f.empresa.id, { ...payloadBase(f), lineas: [{ ...lineaBase(f), articuloId: f.noEmbalaje.id }] }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('rechaza una línea con variedad que no pertenece a la especie de la línea', async () => {
    const f = await crearFixtures()
    await expect(
      crearSolicitud(f.empresa.id, {
        ...payloadBase(f),
        lineas: [{ especieId: f.especie.id, articuloId: f.embalaje.id, variedadId: f.variedadOtraEspecie.id, categoriaIds: [], calibreIds: [] }],
      }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('QAS-SI-014: bloquea eliminar Mercado, País, Variedad, Calibre y Categoría en uso por una solicitud vigente', async () => {
    const f = await crearFixtures()
    await crearSolicitud(f.empresa.id, { ...payloadBase(f), mercadoId: f.mercado.id, paisIds: [f.usa.id] }, 'test')

    await expect(eliminarMantenedor(f.empresa.id, 'mercado', f.mercado.id)).rejects.toMatchObject({ statusCode: 409 })
    await expect(eliminarMantenedor(f.empresa.id, 'pais', f.usa.id)).rejects.toMatchObject({ statusCode: 409 })
    // Especie/variedad vía SolicitudInspeccionLinea; categoría/calibre vía las nietas (viaLinea).
    await expect(eliminarMantenedor(f.empresa.id, 'especie', f.especie.id)).rejects.toMatchObject({ statusCode: 409 })
    await expect(eliminarMantenedor(f.empresa.id, 'variedad', f.variedad.id)).rejects.toMatchObject({ statusCode: 409 })
    await expect(eliminarMantenedor(f.empresa.id, 'calibre', f.calibre.id)).rejects.toMatchObject({ statusCode: 409 })
    await expect(eliminarMantenedor(f.empresa.id, 'categoria', f.categoria.id)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('QAS-SI-014: bloquea eliminar la Entidad usada como Cliente Extranjero de una solicitud vigente', async () => {
    const f = await crearFixtures()
    const creada = await crearSolicitud(f.empresa.id, { ...payloadBase(f), clienteId: f.clienteExtranjero.id }, 'test')
    expect(creada.clienteId).toBe(f.clienteExtranjero.id)
    await expect(eliminarEntidad(f.empresa.id, f.clienteExtranjero.id, 'test')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('obtenerSolicitud devuelve el detalle completo con las líneas anidadas', async () => {
    const f = await crearFixtures()
    const creada = await crearSolicitud(f.empresa.id, { ...payloadBase(f), mercadoId: f.mercado.id }, 'test')
    const detalle = await obtenerSolicitud(f.empresa.id, creada.id)
    expect(detalle.mercado?.id).toBe(f.mercado.id)
    expect(detalle.lineas).toHaveLength(1)
    expect(detalle.lineas[0].especie.id).toBe(f.especie.id)
  })
})
