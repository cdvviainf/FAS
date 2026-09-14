// CLI: genera el Excel base vacío de Carga Masiva de Maestros a partir del
// registro declarativo. Uso:
//   tsx prisma/carga-maestros-generar.ts [ruta-salida.xlsx]
import { writeFile } from 'node:fs/promises'
import { generarTemplate } from '../src/lib/carga-maestros/generar-template.js'
import {
  REGISTRO_MAESTROS,
  ENUM_TIPO_ARTICULO,
  ENUM_TIPO_COSTEO,
  ENUM_TIPO_ENTIDAD,
  ENUM_TIPO_BODEGA,
  ENUM_MODELO_PREFIJO,
} from '../src/modules/config/carga-maestros/registro.js'

async function main() {
  const salida = process.argv[2] ?? 'Carga_Masiva_Maestros_FAS_base.xlsx'
  const buffer = await generarTemplate(REGISTRO_MAESTROS, {
    listasEnum: {
      TipoArticulo: ENUM_TIPO_ARTICULO,
      TipoCosteo: ENUM_TIPO_COSTEO,
      TipoEntidad: ENUM_TIPO_ENTIDAD,
      TipoBodega: ENUM_TIPO_BODEGA,
      ModeloPrefijo: ENUM_MODELO_PREFIJO,
    },
  })
  await writeFile(salida, Buffer.from(buffer))
  console.log(`Template generado: ${salida} (${REGISTRO_MAESTROS.length} hojas de maestros)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
