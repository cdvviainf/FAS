// Asocia masivamente cada País a su Mercado homónimo (mismo nombre) vía
// MercadoPais, para la empresa indicada. Pensado para el caso actual: los
// Mercado de la BD tienen la misma descripción que el Pais correspondiente
// (ej. Mercado "Estados Unidos" <-> Pais "Estados Unidos").
//
// Idempotente: usa upsertMercadoPais (mismo camino que la UI de Países) — un
// País ya asociado al Mercado correcto se deja igual. NUNCA sobreescribe una
// asociación existente que apunte a un Mercado distinto: la reporta como
// CONFLICTO y no la toca (requiere decisión manual).
//
// Uso:
//   tsx prisma/asociar-mercados-paises.ts [CODIGO_EMPRESA] [--dry-run]
//
//   tsx prisma/asociar-mercados-paises.ts AGROSAN --dry-run   (solo reporta, no escribe)
//   tsx prisma/asociar-mercados-paises.ts AGROSAN             (aplica los cambios)
//   tsx prisma/asociar-mercados-paises.ts AGDRY               (otra empresa)
import { prisma } from '../src/lib/prisma.js'
import { empresaContext } from '../src/lib/empresa-context.js'
import { upsertMercadoPais } from '../src/modules/config/config.repository.js'

const USER = 'sistema'

// Normaliza para comparar nombres: minúsculas, sin tildes/diacríticos, sin
// espacios repetidos ni extremos — "Perú" === "peru " === "PERU".
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const codigoEmpresa = args.find((a) => !a.startsWith('--')) ?? 'AGROSAN'

  const empresa = await prisma.empresa.findFirst({ where: { codigo: codigoEmpresa } })
  if (!empresa) throw new Error(`No se encontró la empresa "${codigoEmpresa}".`)

  await empresaContext.run({ empresaId: empresa.id }, async () => {
    // Pais es geografía global (sin empresaId) — Mercado es por-tenant.
    const [paises, mercados, asociacionesExistentes] = await Promise.all([
      prisma.pais.findMany({ where: { eliminadoEn: null }, select: { id: true, descripcion: true } }),
      prisma.mercado.findMany({ where: { eliminadoEn: null }, select: { id: true, descripcion: true } }),
      prisma.mercadoPais.findMany({ where: { empresaId: empresa.id }, select: { paisId: true, mercadoId: true } }),
    ])

    const mercadoPorPaisId = new Map(asociacionesExistentes.map((a) => [a.paisId, a.mercadoId]))
    const mercadosPorNombre = new Map(mercados.map((m) => [normalizar(m.descripcion), m]))

    const creadas: { pais: string; mercado: string }[] = []
    const yaOk: { pais: string; mercado: string }[] = []
    const conflictos: { pais: string; mercadoNuevo: string; mercadoActualId: number }[] = []
    const sinMercado: string[] = []

    for (const pais of paises) {
      const mercado = mercadosPorNombre.get(normalizar(pais.descripcion))
      if (!mercado) {
        sinMercado.push(pais.descripcion)
        continue
      }
      const mercadoActualId = mercadoPorPaisId.get(pais.id)
      if (mercadoActualId === mercado.id) {
        yaOk.push({ pais: pais.descripcion, mercado: mercado.descripcion })
        continue
      }
      if (mercadoActualId != null && mercadoActualId !== mercado.id) {
        conflictos.push({ pais: pais.descripcion, mercadoNuevo: mercado.descripcion, mercadoActualId })
        continue
      }
      if (!dryRun) await upsertMercadoPais(pais.id, mercado.id, USER)
      creadas.push({ pais: pais.descripcion, mercado: mercado.descripcion })
    }

    console.log(`\nEmpresa: ${empresa.codigo}${dryRun ? '  [DRY-RUN — sin escribir cambios]' : ''}`)
    console.log(`Países activos: ${paises.length} · Mercados activos: ${mercados.length}\n`)

    console.log(`✅ ${dryRun ? 'A crear' : 'Creadas'} (${creadas.length}):`)
    creadas.forEach((c) => console.log(`   ${c.pais} → ${c.mercado}`))

    console.log(`\n➖ Ya asociadas correctamente (${yaOk.length}):`)
    yaOk.forEach((c) => console.log(`   ${c.pais} → ${c.mercado}`))

    if (conflictos.length > 0) {
      console.log(`\n⚠️  CONFLICTOS — no tocados, requieren decisión manual (${conflictos.length}):`)
      conflictos.forEach((c) =>
        console.log(`   ${c.pais}: ya asociado a Mercado id=${c.mercadoActualId}, pero el nombre calza con "${c.mercadoNuevo}"`),
      )
    }

    if (sinMercado.length > 0) {
      console.log(`\nℹ️  Países sin Mercado homónimo (${sinMercado.length}, informativo):`)
      console.log(`   ${sinMercado.join(', ')}`)
    }

    console.log(`\n${dryRun ? 'Dry-run finalizado. Corre sin --dry-run para aplicar los cambios.' : 'Listo.'}\n`)
  })
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
