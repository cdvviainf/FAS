/**
 * Bootstrap inicial de producción.
 * Crea el perfil ADMIN y el usuario administrador si no existen.
 *
 * Uso (producción — no requiere fuentes TypeScript):
 *   node --experimental-strip-types prisma/bootstrap-admin.ts
 *
 * Idempotente: puede correrse múltiples veces sin efecto secundario.
 */

import { PrismaClient } from '@prisma/client'
import { hashPassword } from '@better-auth/utils/password'
import { randomBytes } from 'node:crypto'

const ADMIN_EMAIL = 'admin@agrosanexp.com'
const ADMIN_PASSWORD = 'Admin1234!'
const ADMIN_NOMBRE = 'Administrador'

const prisma = new PrismaClient()

function generateId(length = 32): string {
  return randomBytes(length).toString('base64url').slice(0, length)
}

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

  // 3. Crear usuario en Better Auth (tabla User) + Account + tabla usuarios
  const userId = generateId(32)
  const hashedPassword = await hashPassword(ADMIN_PASSWORD)

  await prisma.$transaction(async (tx) => {
    // Better Auth: tabla User
    await tx.$executeRaw`
      INSERT INTO "User" (id, email, name, "emailVerified", "createdAt", "updatedAt")
      VALUES (${userId}, ${ADMIN_EMAIL}, ${ADMIN_NOMBRE}, true, NOW(), NOW())
    `

    // Better Auth: tabla Account (credential)
    const accountId = generateId(32)
    await tx.$executeRaw`
      INSERT INTO "Account" (id, "userId", "providerId", "accountId", password, "createdAt", "updatedAt")
      VALUES (${accountId}, ${userId}, 'credential', ${ADMIN_EMAIL}, ${hashedPassword}, NOW(), NOW())
    `

    // Tabla usuarios (dominio FAS)
    await tx.usuario.create({
      data: {
        id: userId,
        nombre: ADMIN_NOMBRE,
        email: ADMIN_EMAIL,
        perfilId: perfil!.id,
        creadoPor: 'bootstrap',
      },
    })
  })

  console.log('✓ Usuario admin creado: %s / %s', ADMIN_EMAIL, ADMIN_PASSWORD)
}

main()
  .catch((e) => {
    console.error('Error en bootstrap:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
