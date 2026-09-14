// Seed base para la Carga Masiva: crea los PrefijoCodigo (para autogenerar los
// códigos vacíos) y los maestros externos que el Excel referencia pero no crea
// (Grupo de Mercado, Tipos de Embarque, Tipo de Producción). Idempotente:
// ignora los que ya existen. Uso:
//   tsx prisma/carga-maestros-base.ts [CODIGO_EMPRESA]   (default AGROSAN)
import { prisma } from '../src/lib/prisma.js'
import { empresaContext } from '../src/lib/empresa-context.js'
import { crearMantenedor } from '../src/modules/config/config.service.js'
import { crearPrefijoCodigo } from '../src/modules/config/prefijos-codigo/prefijos-codigo.service.js'

const USER = 'sistema'

// Prefijo + dígitos por modelo que autogenera código.
const PREFIJOS: Array<{ modelo: string; prefijo: string; digitos: number }> = [
  { modelo: 'especie', prefijo: 'ESP', digitos: 3 },
  { modelo: 'etiqueta', prefijo: 'ETQ', digitos: 3 },
  { modelo: 'grupoVariedad', prefijo: 'GVA', digitos: 3 },
  { modelo: 'variedad', prefijo: 'VAR', digitos: 4 },
  { modelo: 'categoria', prefijo: 'CAT', digitos: 3 },
  { modelo: 'calibre', prefijo: 'CAL', digitos: 4 },
  { modelo: 'mercado', prefijo: 'MER', digitos: 3 },
  { modelo: 'puerto', prefijo: 'PTO', digitos: 3 },
  { modelo: 'entidad', prefijo: 'EN', digitos: 4 },
  { modelo: 'articulo', prefijo: 'ART', digitos: 4 },
  { modelo: 'bodega', prefijo: 'BOD', digitos: 3 },
  { modelo: 'receta', prefijo: 'REC', digitos: 3 },
]

// Maestros externos: modelo -> registros {codigo, descripcion}.
const EXTERNOS: Array<{ modelo: string; registros: Array<{ codigo: string; descripcion: string }> }> = [
  { modelo: 'grupoMercado', registros: [{ codigo: 'GM', descripcion: 'General' }] },
  {
    modelo: 'tipoEmbarque',
    registros: [
      { codigo: 'MARITIMO', descripcion: 'Marítimo' },
      { codigo: 'AEREO', descripcion: 'Aéreo' },
      { codigo: 'TERRESTRE', descripcion: 'Terrestre' },
    ],
  },
  { modelo: 'tipoProduccion', registros: [{ codigo: 'CONVENCIONAL', descripcion: 'Convencional' }] },
]

async function main() {
  const codigoEmpresa = process.argv[2] ?? 'AGROSAN'
  const empresa = await prisma.empresa.findFirst({ where: { codigo: codigoEmpresa } })
  if (!empresa) throw new Error(`No se encontró la empresa "${codigoEmpresa}".`)

  await empresaContext.run({ empresaId: empresa.id }, async () => {
    let prefijos = 0
    for (const p of PREFIJOS) {
      try {
        await crearPrefijoCodigo({ modelo: p.modelo, prefijo: p.prefijo, digitos: p.digitos } as any, USER)
        prefijos++
      } catch (err: any) {
        if (!/ya existe/i.test(err?.message ?? '')) throw err
      }
    }
    console.log(`PrefijoCodigo: ${prefijos} creados (los existentes se omiten).`)

    let externos = 0
    for (const grupo of EXTERNOS) {
      for (const r of grupo.registros) {
        try {
          await crearMantenedor(grupo.modelo as any, { codigo: r.codigo, descripcion: r.descripcion } as any, USER)
          externos++
        } catch (err: any) {
          if (!/ya existe/i.test(err?.message ?? '')) throw err
        }
      }
    }
    console.log(`Maestros externos: ${externos} creados (GrupoMercado, TipoEmbarque, TipoProduccion).`)
  })
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
