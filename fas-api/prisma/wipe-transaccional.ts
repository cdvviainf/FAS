// CLI PROTEGIDO: vacía las tablas transaccionales y de maestros para re-poblar
// desde cero (Carga Masiva). PRESERVA el andamiaje: auth (User/Session/Account/
// Verification), tenant (empresas + usuarios + membresías) y autorización
// (items_menu/perfiles/perfil_accesos). Todo lo demás —incluida la geografía,
// parámetros y maestros— se trunca; re-siémbralos con el flujo de recarga.
//
// Uso:
//   tsx prisma/wipe-transaccional.ts            # muestra qué truncaría (preview)
//   tsx prisma/wipe-transaccional.ts --force    # ejecuta
//
// Flujo de recarga completo sugerido tras el wipe:
//   1) npm run db:seed:geografia   (paises CHL, regiones, provincias, comunas)
//   2) npm run db:seed             (parámetros, unidades, notas, placeholder)
//   3) tsx prisma/carga-maestros-base.ts        (prefijos + maestros externos)
//   4) tsx prisma/carga-maestros-cargar.ts <archivo.xlsx> --commit
import { prisma } from '../src/lib/prisma.js'

const PRESERVAR = new Set<string>([
  '_prisma_migrations',
  // Auth (Better Auth)
  'User', 'Session', 'Account', 'Verification',
  // Tenant / empresa
  'empresas', 'empresa_contactos', 'empresa_direcciones', 'empresa_logos',
  'usuario_empresas', 'usuarios', 'usuarios_avatar',
  // Autorización
  'items_menu', 'perfiles', 'perfil_accesos',
])

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('ABORTADO: no se permite en NODE_ENV=production.')
    process.exit(1)
  }
  const force = process.argv.includes('--force')

  const filas = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
  )
  const aTruncar = filas.map((f) => f.tablename).filter((t) => !PRESERVAR.has(t))

  console.log(`\nTablas a TRUNCAR (${aTruncar.length}):`)
  console.log('  ' + aTruncar.join(', '))
  console.log(`\nSe PRESERVAN (${PRESERVAR.size}): ${[...PRESERVAR].join(', ')}`)

  if (!force) {
    console.log('\n[PREVIEW] No se ejecutó nada. Corre con --force para truncar.')
    return
  }

  const lista = aTruncar.map((t) => `"${t}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE ${lista} RESTART IDENTITY CASCADE`)
  console.log(`\nOK: ${aTruncar.length} tablas truncadas (identidad reiniciada).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
