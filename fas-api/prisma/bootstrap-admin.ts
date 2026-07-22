/**
 * Bootstrap inicial de producción.
 * Crea el perfil ADMIN y el usuario administrador si no existen.
 *
 * Uso:
 *   node --experimental-strip-types prisma/bootstrap-admin.ts
 *
 * Se puede correr múltiples veces sin efecto secundario (idempotente).
 */

import { PrismaClient } from '@prisma/client'
import { auth } from '../src/lib/auth.js'

const ADMIN_EMAIL = 'admin@agrosanexp.com'
const ADMIN_PASSWORD = 'Admin1234!'
const ADMIN_NOMBRE = 'Administrador'

const prisma = new PrismaClient()

async function main() {
  // 1. Crear perfil ADMIN si no existe
  let perfil = await prisma.perfil.findFirst({ where: { codigo: 'ADMIN', eliminadoEn: null } })
  if (!perfil) {
    perfil = await prisma.perfil.create({
      data: {
        codigo: 'ADMIN',
        descripcion: 'Administrador — acceso total al sistema',
        creadoPor: 'bootstrap',
      },
    })
    console.log('✓ Perfil ADMIN creado (id=%d)', perfil.id)
  } else {
    console.log('· Perfil ADMIN ya existe (id=%d)', perfil.id)
  }

  // 2. Verificar si el usuario admin ya existe
  const usuarioExistente = await prisma.usuario.findFirst({ where: { email: ADMIN_EMAIL, eliminadoEn: null } })
  if (usuarioExistente) {
    console.log('· Usuario admin ya existe (%s) — no se modifica', ADMIN_EMAIL)
    return
  }

  // 3. Crear usuario en Better Auth + tabla usuarios
  const ctx = await auth.$context
  const userId = ctx.generateId({ model: 'user' })

  const authUser = await ctx.internalAdapter.createUser({
    id: userId,
    email: ADMIN_EMAIL,
    name: ADMIN_NOMBRE,
    emailVerified: true,
  })

  try {
    const hashedPassword = await ctx.password.hash(ADMIN_PASSWORD)
    await ctx.internalAdapter.linkAccount({
      userId: authUser.id,
      providerId: 'credential',
      accountId: ADMIN_EMAIL,
      password: hashedPassword,
    })

    await prisma.usuario.create({
      data: {
        id: authUser.id,
        nombre: ADMIN_NOMBRE,
        email: ADMIN_EMAIL,
        perfilId: perfil.id,
        creadoPor: 'bootstrap',
      },
    })

    console.log('✓ Usuario admin creado: %s / %s', ADMIN_EMAIL, ADMIN_PASSWORD)
  } catch (err) {
    await ctx.internalAdapter.deleteUser(authUser.id).catch(() => {})
    throw err
  }
}

main()
  .catch((e) => {
    console.error('Error en bootstrap:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
