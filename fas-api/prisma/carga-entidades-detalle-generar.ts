// CLI: genera el Excel de Carga Masiva de Direcciones y Contactos, con las
// hojas de referencia (Entidades/Comunas/Países) pobladas desde la BD. Uso:
//   tsx prisma/carga-entidades-detalle-generar.ts [ruta-salida.xlsx] [--empresa=AGROSAN]
import { writeFile } from 'node:fs/promises'
import { prisma } from '../src/lib/prisma.js'
import { generarTemplateEntidadesDetalle } from '../src/modules/config/carga-entidades-detalle/carga-entidades-detalle.service.js'

function arg(nombre: string): string | undefined {
  const p = process.argv.find((a) => a.startsWith(`--${nombre}=`))
  return p ? p.split('=').slice(1).join('=') : undefined
}

async function main() {
  const salida = process.argv[2] && !process.argv[2].startsWith('--')
    ? process.argv[2]
    : 'Carga_Direcciones_Contactos.xlsx'
  const codigoEmpresa = arg('empresa') ?? 'AGROSAN'

  const empresa = await prisma.empresa.findFirst({ where: { codigo: codigoEmpresa } })
  if (!empresa) throw new Error(`No se encontró la empresa "${codigoEmpresa}".`)

  const buffer = await generarTemplateEntidadesDetalle(empresa.id)
  await writeFile(salida, Buffer.from(buffer))
  console.log(`Template generado: ${salida} (empresa ${codigoEmpresa})`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
