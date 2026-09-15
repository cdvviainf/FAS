// CLI: carga (o valida) el Excel de Direcciones y Contactos contra la BD. Uso:
//   tsx prisma/carga-entidades-detalle-cargar.ts <archivo.xlsx> [--commit] [--empresa=AGROSAN] [--reporte=salida.xlsx]
// Por defecto corre en dry-run (no escribe). Con --commit escribe reutilizando
// los services de Entidades (crearDireccion / crearContacto).
import { writeFile } from 'node:fs/promises'
import { prisma } from '../src/lib/prisma.js'
import { cargarEntidadesDetalle } from '../src/modules/config/carga-entidades-detalle/carga-entidades-detalle.service.js'
import { generarReporteErrores } from '../src/lib/carga-maestros/reporte-errores.js'

function arg(nombre: string): string | undefined {
  const p = process.argv.find((a) => a.startsWith(`--${nombre}=`))
  return p ? p.split('=').slice(1).join('=') : undefined
}

async function main() {
  const archivo = process.argv[2]
  if (!archivo || archivo.startsWith('--')) {
    console.error('Uso: tsx prisma/carga-entidades-detalle-cargar.ts <archivo.xlsx> [--commit] [--empresa=AGROSAN] [--reporte=salida.xlsx]')
    process.exit(1)
  }
  const commit = process.argv.includes('--commit')
  const codigoEmpresa = arg('empresa') ?? 'AGROSAN'
  const salida = arg('reporte') ?? 'Reporte_Direcciones_Contactos.xlsx'

  const empresa = await prisma.empresa.findFirst({ where: { codigo: codigoEmpresa } })
  if (!empresa) throw new Error(`No se encontró la empresa "${codigoEmpresa}".`)

  console.log(`\n=== Carga Direcciones/Contactos ${commit ? '(COMMIT)' : '(dry-run)'} — empresa ${codigoEmpresa} ===`)
  const res = await cargarEntidadesDetalle(archivo, { empresaId: empresa.id, dryRun: !commit })

  for (const [hoja, r] of Object.entries(res.resumen)) {
    const nErr = res.errores.filter((e) => e.hoja === hoja).length
    console.log(`  ${hoja.padEnd(14)} filas=${String(r.filas).padStart(4)}  creados=${String(r.creados).padStart(4)}  errores=${nErr}`)
  }
  console.log(`\nTOTAL creados: ${Object.values(res.resumen).reduce((a, r) => a + r.creados, 0)} | errores: ${res.errores.length}`)
  const porTipo = new Map<string, number>()
  for (const e of res.errores) porTipo.set(e.codigo, (porTipo.get(e.codigo) ?? 0) + 1)
  if (porTipo.size) console.log('Por tipo:', Object.fromEntries([...porTipo.entries()].sort((a, b) => b[1] - a[1])))

  if (res.errores.length) {
    await writeFile(salida, Buffer.from(await generarReporteErrores(res.errores)))
    console.log(`\nReporte de errores: ${salida}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
