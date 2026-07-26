import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma.js'
import { crearSolicitud, actualizarSolicitud, obtenerSolicitud } from '../../src/modules/calidad/solicitudes/solicitudes.service.js'
import { eliminarMantenedor } from '../../src/modules/config/config.service.js'

const databaseName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1)
if (databaseName !== 'fas_test') {
  throw new Error(`Seguridad: las pruebas de Solicitudes requieren fas_test; recibido "${databaseName}"`)
}

async function limpiarDatos() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "solicitud_inspeccion_paises",
      "solicitud_inspeccion_variedades",
      "solicitud_inspeccion_calibres",
      "solicitud_inspeccion_categorias",
      "solicitud_inspeccion_embalajes",
      "solicitud_inspeccion_asignados",
      "solicitudes_inspeccion",
      "calificaciones",
      "articulos",
      "calibres",
      "categorias",
      "variedades",
      "especies",
      "mercados",
      "grupos_mercado",
      "motivos_inspeccion",
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

async function crearFixtures() {
  const chile = await prisma.pais.create({ data: { codigo: 'CHL', descripcion: 'Chile', esPaisOrigen: true, creadoPor: 'test' } })
  const usa = await prisma.pais.create({ data: { codigo: 'USA', descripcion: 'Estados Unidos', creadoPor: 'test' } })

  const productor = await prisma.entidad.create({
    data: { codigo: 'PROD-01', descripcion: 'Productor Uno', razonSocial: 'Productor Uno SpA', paisId: chile.id, tipos: ['PRODUCTOR'], creadoPor: 'test' },
  })
  const direccion = await prisma.entidadDireccion.create({
    data: { entidadId: productor.id, codigo: 'D1', paisId: chile.id, direccion: 'Camino Interior 123', creadoPor: 'test' },
  })
  const clienteExtranjero = await prisma.entidad.create({
    data: { codigo: 'CLI-EXT', descripcion: 'Cliente USA', razonSocial: 'Cliente USA Inc', paisId: usa.id, tipos: ['CLIENTE_EXTRANJERO'], creadoPor: 'test' },
  })
  const clienteNoExtranjero = await prisma.entidad.create({
    data: { codigo: 'CLI-NAC', descripcion: 'Cliente Nacional', razonSocial: 'Cliente Nacional SpA', paisId: chile.id, tipos: ['CLIENTE_NACIONAL'], creadoPor: 'test' },
  })

  const temporada = await prisma.temporada.create({
    data: { codigo: 'T26', descripcion: 'Temporada 2026', fechaInicio: new Date('2026-01-01'), fechaTermino: new Date('2026-12-31'), creadoPor: 'test' },
  })
  const motivo = await prisma.motivoInspeccion.create({ data: { codigo: 'MOT-01', descripcion: 'Inspección de rutina', creadoPor: 'test' } })

  const especie = await prisma.especie.create({ data: { codigo: 'UV', descripcion: 'Uva', creadoPor: 'test' } })
  const otraEspecie = await prisma.especie.create({ data: { codigo: 'CZ', descripcion: 'Cereza', creadoPor: 'test' } })
  const variedad = await prisma.variedad.create({ data: { codigo: 'RG', descripcion: 'Red Globe', especieId: especie.id, creadoPor: 'test' } })
  const variedadOtraEspecie = await prisma.variedad.create({ data: { codigo: 'BING', descripcion: 'Bing', especieId: otraEspecie.id, creadoPor: 'test' } })
  const calibre = await prisma.calibre.create({ data: { codigo: 'XL', descripcion: 'XL', especieId: especie.id, orden: 1, control: [], creadoPor: 'test' } })
  const categoria = await prisma.categoria.create({ data: { codigo: 'CAT1', descripcion: 'Categoría 1', especieId: especie.id, orden: 1, control: [], creadoPor: 'test' } })

  const grupoMercado = await prisma.grupoMercado.create({ data: { codigo: 'GM1', descripcion: 'Grupo 1', creadoPor: 'test' } })
  const mercado = await prisma.mercado.create({ data: { codigo: 'MK1', descripcion: 'Mercado 1', grupoMercadoId: grupoMercado.id, paisId: usa.id, creadoPor: 'test' } })

  const unidad = await prisma.unidadMedida.create({ data: { codigo: 'CAJA', descripcion: 'Caja', creadoPor: 'test' } })
  const embalaje = await prisma.articulo.create({
    data: { tipo: 'EMBALAJE', codigo: 'ART-EMB', descripcion: 'Caja embalaje', unidadId: unidad.id, tipoCosteo: 'PROMEDIO_PONDERADO' },
  })
  const noEmbalaje = await prisma.articulo.create({
    data: { tipo: 'SERVICIO', codigo: 'ART-SERV', descripcion: 'Servicio', unidadId: unidad.id, tipoCosteo: 'PROMEDIO_PONDERADO' },
  })

  const calificacion = await prisma.calificacion.create({ data: { codigo: 'B1', descripcion: 'B1', creadoPor: 'test' } })

  const perfil = await prisma.perfil.create({ data: { codigo: 'PERFIL-1', descripcion: 'Perfil de prueba', creadoPor: 'test' } })
  const usuario = await prisma.usuario.create({
    data: { id: 'usuario-1', nombre: 'Usuario Uno', email: 'usuario1@example.invalid', perfilId: perfil.id, creadoPor: 'test' },
  })

  return {
    chile, usa, productor, direccion, clienteExtranjero, clienteNoExtranjero,
    temporada, motivo, especie, otraEspecie, variedad, variedadOtraEspecie, calibre, categoria,
    grupoMercado, mercado, unidad, embalaje, noEmbalaje, calificacion, usuario,
  }
}

function payloadBase(f: Awaited<ReturnType<typeof crearFixtures>>) {
  return {
    temporadaId: f.temporada.id,
    entidadProductorId: f.productor.id,
    direccionId: f.direccion.id,
    motivoId: f.motivo.id,
    fechaHora: new Date('2026-08-01T15:00:00Z').toISOString(),
    asignados: [{ usuarioId: f.usuario.id, funcion: 'ACUDIR' as const }],
  }
}

describe('Solicitud de Inspección — Documento 107 contra PostgreSQL', () => {
  beforeEach(limpiarDatos)
  afterAll(async () => {
    await limpiarDatos()
    await prisma.$disconnect()
  })

  it('crea una solicitud con todos los campos del Documento 107 y los persiste', async () => {
    const f = await crearFixtures()
    const solicitud = await crearSolicitud({
      ...payloadBase(f),
      mercadoId: f.mercado.id,
      paisIds: [f.usa.id],
      clienteId: f.clienteExtranjero.id,
      fechaDespacho: '2026-09-01',
      especieId: f.especie.id,
      variedadIds: [f.variedad.id],
      calibreIds: [f.calibre.id],
      categoriaIds: [f.categoria.id],
      articuloIds: [f.embalaje.id],
      calificacionId: f.calificacion.id,
      cantidadPallets: 12,
    }, 'test')

    expect(solicitud.mercadoId).toBe(f.mercado.id)
    expect(solicitud.paises).toHaveLength(1)
    expect(solicitud.clienteId).toBe(f.clienteExtranjero.id)
    expect(solicitud.cantidadPallets).toBe(12)
    expect(solicitud.variedades).toHaveLength(1)
    expect(solicitud.calibres).toHaveLength(1)
    expect(solicitud.categorias).toHaveLength(1)
    expect(solicitud.embalajes).toHaveLength(1)
    expect(solicitud.calificacionId).toBe(f.calificacion.id)
  })

  it('permite editar una solicitud y limpiar los multiselects enviando arreglos vacíos', async () => {
    const f = await crearFixtures()
    const creada = await crearSolicitud({
      ...payloadBase(f),
      especieId: f.especie.id,
      variedadIds: [f.variedad.id],
      calibreIds: [f.calibre.id],
      categoriaIds: [f.categoria.id],
      paisIds: [f.usa.id],
    }, 'test')

    const editada = await actualizarSolicitud(creada.id, {
      variedadIds: [],
      calibreIds: [],
      categoriaIds: [],
      paisIds: [],
    }, 'test')

    expect(editada.variedades).toHaveLength(0)
    expect(editada.calibres).toHaveLength(0)
    expect(editada.categorias).toHaveLength(0)
    expect(editada.paises).toHaveLength(0)
  })

  it('no toca los multiselects si no vienen en el body de edición', async () => {
    const f = await crearFixtures()
    const creada = await crearSolicitud({
      ...payloadBase(f),
      especieId: f.especie.id,
      variedadIds: [f.variedad.id],
    }, 'test')

    const editada = await actualizarSolicitud(creada.id, { observaciones: 'sin tocar variedades' }, 'test')
    expect(editada.variedades).toHaveLength(1)
  })

  it('rechaza mercado inexistente y cliente que no es Cliente Extranjero', async () => {
    const f = await crearFixtures()

    await expect(crearSolicitud({ ...payloadBase(f), mercadoId: 999999 }, 'test'))
      .rejects.toMatchObject({ statusCode: 422 })

    await expect(crearSolicitud({ ...payloadBase(f), clienteId: f.clienteNoExtranjero.id }, 'test'))
      .rejects.toMatchObject({ statusCode: 422 })
  })

  it('rechaza un embalaje que no es artículo tipo EMBALAJE', async () => {
    const f = await crearFixtures()
    await expect(crearSolicitud({ ...payloadBase(f), articuloIds: [f.noEmbalaje.id] }, 'test'))
      .rejects.toMatchObject({ statusCode: 422 })
  })

  it('rechaza variedad/calibre/categoría que no pertenecen a la especie seleccionada', async () => {
    const f = await crearFixtures()
    await expect(
      crearSolicitud({ ...payloadBase(f), especieId: f.especie.id, variedadIds: [f.variedadOtraEspecie.id] }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('rechaza calificación bloqueada', async () => {
    const f = await crearFixtures()
    await prisma.calificacion.update({ where: { id: f.calificacion.id }, data: { bloqueado: true } })
    await expect(
      crearSolicitud({ ...payloadBase(f), calificacionId: f.calificacion.id }, 'test'),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('QAS-SI-014: bloquea eliminar Mercado, País, Variedad, Calibre, Categoría y Calificación en uso por una solicitud vigente', async () => {
    const f = await crearFixtures()
    await crearSolicitud({
      ...payloadBase(f),
      mercadoId: f.mercado.id,
      paisIds: [f.usa.id],
      especieId: f.especie.id,
      variedadIds: [f.variedad.id],
      calibreIds: [f.calibre.id],
      categoriaIds: [f.categoria.id],
      calificacionId: f.calificacion.id,
    }, 'test')

    await expect(eliminarMantenedor('mercado', f.mercado.id)).rejects.toMatchObject({ statusCode: 409 })
    await expect(eliminarMantenedor('pais', f.usa.id)).rejects.toMatchObject({ statusCode: 409 })
    await expect(eliminarMantenedor('variedad', f.variedad.id)).rejects.toMatchObject({ statusCode: 409 })
    await expect(eliminarMantenedor('calibre', f.calibre.id)).rejects.toMatchObject({ statusCode: 409 })
    await expect(eliminarMantenedor('categoria', f.categoria.id)).rejects.toMatchObject({ statusCode: 409 })
    await expect(eliminarMantenedor('calificacion', f.calificacion.id)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('QAS-SI-014: bloquea eliminar la Entidad usada como Cliente Extranjero de una solicitud vigente', async () => {
    const f = await crearFixtures()
    const creada = await crearSolicitud({ ...payloadBase(f), clienteId: f.clienteExtranjero.id }, 'test')
    expect(creada.clienteId).toBe(f.clienteExtranjero.id)

    const { eliminarEntidad } = await import('../../src/modules/config/entidades/entidades.service.js')
    await expect(eliminarEntidad(f.clienteExtranjero.id, 'test')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('obtenerSolicitud devuelve el detalle completo con las relaciones nuevas', async () => {
    const f = await crearFixtures()
    const creada = await crearSolicitud({
      ...payloadBase(f),
      mercadoId: f.mercado.id,
      calificacionId: f.calificacion.id,
    }, 'test')
    const detalle = await obtenerSolicitud(creada.id)
    expect(detalle.mercado?.id).toBe(f.mercado.id)
    expect(detalle.calificacion?.id).toBe(f.calificacion.id)
  })
})
