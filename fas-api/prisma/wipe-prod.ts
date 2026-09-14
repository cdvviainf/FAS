// WIPE de PRODUCCIÓN (self-contained: solo @prisma/client, corre con
// `node --experimental-strip-types` en el contenedor de Coolify, igual que el
// seed). Vacía maestros + transaccional para repoblar desde cero, PRESERVANDO
// el andamiaje (auth, empresas/usuarios, menú/perfiles). Además elimina el
// índice único de identificador de entidades (por si la migración
// 20260914120000 no se aplicó en este entorno).
//
// Uso (dentro del contenedor):
//   node --experimental-strip-types prisma/wipe-prod.ts            # preview
//   node --experimental-strip-types prisma/wipe-prod.ts --force    # ejecuta
//
// Flujo completo de recarga tras el wipe:
//   node --experimental-strip-types prisma/wipe-prod.ts --force
//   node --experimental-strip-types prisma/seed-geografia-chile.ts
//   node --experimental-strip-types prisma/seed.ts
//   (luego subir el Excel por la pantalla Carga Masiva, o curl al endpoint)
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PRESERVAR = new Set<string>([
  '_prisma_migrations',
  'User', 'Session', 'Account', 'Verification',
  'empresas', 'empresa_contactos', 'empresa_direcciones', 'empresa_logos',
  'usuario_empresas', 'usuarios', 'usuarios_avatar',
  'items_menu', 'perfiles', 'perfil_accesos',
])

async function main() {
  const force = process.argv.includes('--force')

  const filas = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
  )
  const aTruncar = filas.map((f) => f.tablename).filter((t) => !PRESERVAR.has(t))

  console.log(`Tablas a TRUNCAR (${aTruncar.length}):`)
  console.log('  ' + aTruncar.join(', '))
  console.log(`\nSe PRESERVAN (${PRESERVAR.size}): ${[...PRESERVAR].join(', ')}`)
  console.log('Nota: las direcciones de empresa (empresa_direcciones) pueden vaciarse por cascada al truncar comunas.')

  if (!force) {
    console.log('\n[PREVIEW] Nada ejecutado. Agrega --force para truncar.')
    return
  }

  const lista = aTruncar.map((t) => `"${t}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE ${lista} RESTART IDENTITY CASCADE`)
  console.log(`\nOK: ${aTruncar.length} tablas truncadas.`)

  // Asegura la regla "RUT único solo para chilenas": elimina el índice único de
  // identificador si sigue presente (migración 20260914120000).
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "entidades_empresa_identificador_activo_key"`)
  console.log('Índice único de identificador eliminado (si existía).')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
