import { randomBytes } from 'node:crypto'
import { hashPassword } from '@better-auth/utils/password'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { prisma } from '../../src/lib/prisma.js'
import { redis } from '../../src/lib/redis.js'

const databaseName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1)
if (databaseName !== 'fas_test') {
  throw new Error(`Seguridad: las pruebas HTTP requieren fas_test; recibido "${databaseName}"`)
}

let app: FastifyInstance

async function limpiarDatos() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Session",
      "Account",
      "usuarios",
      "perfil_accesos",
      "perfiles",
      "items_menu",
      "User",
      "comunas",
      "provincias",
      "regiones",
      "paises",
      "temporadas"
    RESTART IDENTITY CASCADE
  `)
}

async function crearSesion(
  nivel: 'LECTURA' | 'TOTAL',
  itemCodigo = 'CONFIG_MANTENEDORES',
) {
  const suffix = randomBytes(5).toString('hex')
  const userId = `test-${suffix}`
  const email = `${userId}@example.invalid`
  const password = 'PruebaSegura123!'
  const perfil = await prisma.perfil.create({
    data: { codigo: `PERFIL-${suffix}`, descripcion: 'Perfil de prueba', creadoPor: 'test' },
  })
  const item = await prisma.itemMenu.create({
    data: {
      codigo: itemCodigo,
      nombre: 'Mantenedores',
      seccion: 'Configuración',
    },
  })
  await prisma.perfilAcceso.create({
    data: { perfilId: perfil.id, itemMenuId: item.id, nivel },
  })
  await prisma.user.create({
    data: {
      id: userId,
      email,
      name: 'Usuario prueba',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  await prisma.account.create({
    data: {
      id: `account-${suffix}`,
      userId,
      providerId: 'credential',
      accountId: email,
      password: await hashPassword(password),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  await prisma.usuario.create({
    data: {
      id: userId,
      nombre: 'Usuario prueba',
      email,
      perfilId: perfil.id,
      creadoPor: 'test',
    },
  })

  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    payload: { email, password },
  })
  expect(login.statusCode).toBe(200)
  const setCookie = login.headers['set-cookie']
  const cookieValue = Array.isArray(setCookie) ? setCookie[0] : setCookie
  expect(cookieValue).toBeTruthy()
  return { cookie: cookieValue!.split(';')[0], userId, email, password }
}

describe('contrato HTTP de la API', () => {
  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })
  beforeEach(limpiarDatos)
  afterAll(async () => {
    await limpiarDatos()
    await app.close()
    await prisma.$disconnect()
    await redis.quit()
  })

  it('expone salud de API, PostgreSQL y Redis', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      status: 'ok',
      checks: { api: 'ok', database: 'ok', redis: 'ok' },
    })
  })

  it('impide registro público y acceso anónimo a configuración', async () => {
    const signUp = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: {
        name: 'No crear',
        email: 'no-crear@example.invalid',
        password: 'NoCrear123!',
      },
    })
    const protectedRoute = await app.inject({
      method: 'GET',
      url: '/api/config/regiones',
    })

    expect(signUp.statusCode).toBe(403)
    expect(signUp.json().error.code).toBe('REGISTRATION_DISABLED')
    expect(protectedRoute.statusCode).toBe(401)
  })

  it.each([
    '/api/config/paises',
    '/api/config/zonas',
    '/api/config/grupos-mercado',
    '/api/config/tipos-embarque',
    '/api/config/unidades-medida',
    '/api/config/tipos-pallet',
    '/api/config/alturas',
    '/api/config/tipos-produccion',
    '/api/config/tipos-defecto',
    '/api/config/tipos-parametro',
    '/api/config/regiones',
    '/api/config/especies',
    '/api/config/provincias',
    '/api/config/comunas',
    '/api/config/grupos-variedad',
    '/api/config/variedades',
    '/api/config/categorias',
    '/api/config/calibres',
    '/api/config/parametros',
    '/api/config/mercados',
    '/api/config/puertos',
    '/api/config/monedas',
    '/api/config/conceptos-cta-cte',
    '/api/config/temporadas',
    '/api/config/bodegas',
    '/api/config/perfiles',
    '/api/config/usuarios',
    '/api/config/entidades',
    '/api/config/correo',
    '/api/calidad/solicitudes',
    '/api/materiales/articulos',
    '/api/productores',
  ])('protege la ruta construida %s', async (url) => {
    const response = await app.inject({ method: 'GET', url })

    expect(response.statusCode).toBe(401)
    expect(response.json().error.code).toBe('UNAUTHORIZED')
  })

  it('ejecuta CRUD autenticado y registra auditoría del usuario', async () => {
    const { cookie, userId } = await crearSesion('TOTAL')
    const created = await app.inject({
      method: 'POST',
      url: '/api/config/regiones',
      headers: { cookie },
      payload: { codigo: 'RM', descripcion: 'Metropolitana' },
    })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({ codigo: 'RM', creadoPor: userId })

    const listed = await app.inject({
      method: 'GET',
      url: '/api/config/regiones',
      headers: { cookie },
    })
    expect(listed.statusCode).toBe(200)
    expect(listed.json().meta.total).toBe(1)

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/config/regiones/${created.json().id}`,
      headers: { cookie },
    })
    expect(removed.statusCode).toBe(204)

    const stored = await prisma.region.findUnique({ where: { id: created.json().id } })
    expect(stored).toMatchObject({ eliminadoPor: userId })
    expect(stored?.eliminadoEn).toBeInstanceOf(Date)
  })

  it('aplica Zod y responde 422 ante datos inválidos', async () => {
    const { cookie } = await crearSesion('TOTAL')
    const response = await app.inject({
      method: 'POST',
      url: '/api/config/paises',
      headers: { cookie },
      payload: { codigo: 'CL', descripcion: '' },
    })

    expect(response.statusCode).toBe(422)
    expect(response.json().error.code).toBe('VALIDATION_ERROR')
  })

  it('permite lectura pero rechaza escrituras a un perfil LECTURA', async () => {
    const { cookie } = await crearSesion('LECTURA')
    const listed = await app.inject({
      method: 'GET',
      url: '/api/config/regiones',
      headers: { cookie },
    })
    const created = await app.inject({
      method: 'POST',
      url: '/api/config/regiones',
      headers: { cookie },
      payload: { codigo: 'RM', descripcion: 'Metropolitana' },
    })

    expect(listed.statusCode).toBe(200)
    expect(created.statusCode).toBe(403)
  })

  it('cambia la contraseña propia validando complejidad y contraseña actual', async () => {
    const { cookie, email, password } = await crearSesion('LECTURA')

    const debil = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { cookie },
      payload: {
        currentPassword: password,
        newPassword: 'debil',
        revokeOtherSessions: true,
      },
    })
    expect(debil.statusCode).toBe(422)
    expect(debil.json()).toMatchObject({ code: 'VALIDATION_ERROR' })

    const actualIncorrecta = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { cookie },
      payload: {
        currentPassword: 'Incorrecta123!',
        newPassword: 'NuevaSegura456!',
        revokeOtherSessions: true,
      },
    })
    expect(actualIncorrecta.statusCode).toBeGreaterThanOrEqual(400)

    const cambiada = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { cookie },
      payload: {
        currentPassword: password,
        newPassword: 'NuevaSegura456!',
        revokeOtherSessions: true,
      },
    })
    expect(cambiada.statusCode).toBe(200)

    const loginAnterior = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email, password },
    })
    expect(loginAnterior.statusCode).toBeGreaterThanOrEqual(400)

    const loginNuevo = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email, password: 'NuevaSegura456!' },
    })
    expect(loginNuevo.statusCode).toBe(200)
  })

  it('no filtra contratos a un perfil con Ficha pero sin permiso de Contratos', async () => {
    const { cookie } = await crearSesion('LECTURA', 'PROD_FICHA')
    const pais = await prisma.pais.create({
      data: { codigo: 'CHL', descripcion: 'Chile', creadoPor: 'test' },
    })
    const productor = await prisma.entidad.create({
      data: {
        codigo: 'PROD-QA',
        descripcion: 'Productor QA',
        razonSocial: 'Productor QA SpA',
        paisId: pais.id,
        tipos: ['PRODUCTOR'],
        creadoPor: 'test',
      },
    })
    await prisma.productorContrato.create({
      data: {
        entidadId: productor.id,
        condicionesPago: 'Dato contractual reservado',
        creadoPor: 'test',
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: `/api/productores/${productor.id}`,
      headers: { cookie },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().data.contratos).toEqual([])
  })
})
