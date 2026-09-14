// CLI: valida (dry-run SIN tocar la BD) un Excel de Carga Masiva y emite un
// reporte de errores estructurales + FKs internas. Uso:
//   tsx prisma/carga-maestros-validar.ts <archivo.xlsx> [reporte-salida.xlsx]
import { writeFile } from 'node:fs/promises'
import { parsearLibro, validarReferenciasInternas } from '../src/lib/carga-maestros/parsear.js'
import { generarReporteErrores } from '../src/lib/carga-maestros/reporte-errores.js'
import { REGISTRO_MAESTROS } from '../src/modules/config/carga-maestros/registro.js'

async function main() {
  const archivo = process.argv[2]
  if (!archivo) {
    console.error('Uso: tsx prisma/carga-maestros-validar.ts <archivo.xlsx> [reporte.xlsx]')
    process.exit(1)
  }
  const salida = process.argv[3] ?? 'Reporte_Errores_Carga_Masiva.xlsx'

  const parseo = await parsearLibro(archivo, REGISTRO_MAESTROS)
  const erroresFk = validarReferenciasInternas(parseo, REGISTRO_MAESTROS)
  const todos = [...parseo.errores, ...Object.values(parseo.hojas).flatMap((h) => h.errores), ...erroresFk]

  console.log(`\n=== Validación de ${archivo} ===`)
  for (const hoja of REGISTRO_MAESTROS) {
    const r = parseo.hojas[hoja.hoja]
    const nErr = todos.filter((e) => e.hoja === hoja.hoja).length
    console.log(`  ${hoja.hoja.padEnd(16)} filas=${String(r.filas.length).padStart(4)}  errores=${nErr}`)
  }
  console.log(`\nTOTAL errores: ${todos.length}`)

  // Top de errores por tipo.
  const porTipo = new Map<string, number>()
  for (const e of todos) porTipo.set(e.codigo, (porTipo.get(e.codigo) ?? 0) + 1)
  console.log('Por tipo:', Object.fromEntries([...porTipo.entries()].sort((a, b) => b[1] - a[1])))

  const buffer = await generarReporteErrores(todos)
  await writeFile(salida, Buffer.from(buffer))
  console.log(`\nReporte escrito: ${salida}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
