/**
 * Carga masiva de la división político-administrativa oficial de Chile:
 * Región → Provincia → Comuna (16 regiones, 56 provincias, 346 comunas).
 *
 * Fuente: "Códigos Únicos Territoriales, vigentes a partir del 6 de septiembre
 * de 2018" — Ministerio del Interior, Subsecretaría de Desarrollo Regional y
 * Administrativo (SUBDERE). Incluye la Región de Ñuble (creada en 2018).
 *
 * Idempotente: upsert por `codigo` (entre no eliminados). Puede correrse
 * múltiples veces sin duplicar datos ni afectar registros que ya tengan FKs
 * (Bodega, EntidadDireccion, Predio) — nunca elimina ni reasigna nada.
 *
 * Uso (dev):        npm run db:seed:geografia
 * Uso (producción): node --experimental-strip-types prisma/seed-geografia-chile.ts
 */

import { PrismaClient } from '@prisma/client'
import { REGIONES_CHILE } from './regiones-chile-data.ts'

const prisma = new PrismaClient()
const SISTEMA = 'sistema'

async function upsertRegion(codigo: string, descripcion: string) {
  const existente = await prisma.region.findFirst({ where: { codigo, eliminadoEn: null } })
  if (existente) {
    return prisma.region.update({
      where: { id: existente.id },
      data: { descripcion, actualizadoPor: SISTEMA },
    })
  }
  return prisma.region.create({ data: { codigo, descripcion, creadoPor: SISTEMA } })
}

async function upsertProvincia(codigo: string, descripcion: string, regionId: number) {
  const existente = await prisma.provincia.findFirst({ where: { codigo, eliminadoEn: null } })
  if (existente) {
    return prisma.provincia.update({
      where: { id: existente.id },
      data: { descripcion, regionId, actualizadoPor: SISTEMA },
    })
  }
  return prisma.provincia.create({ data: { codigo, descripcion, regionId, creadoPor: SISTEMA } })
}

async function upsertComuna(codigo: string, descripcion: string, provinciaId: number) {
  const existente = await prisma.comuna.findFirst({ where: { codigo, eliminadoEn: null } })
  if (existente) {
    return prisma.comuna.update({
      where: { id: existente.id },
      data: { descripcion, provinciaId, actualizadoPor: SISTEMA },
    })
  }
  return prisma.comuna.create({ data: { codigo, descripcion, provinciaId, creadoPor: SISTEMA } })
}

async function main() {
  let regiones = 0
  let provincias = 0
  let comunas = 0

  for (const r of REGIONES_CHILE) {
    const region = await upsertRegion(r.codigo, r.descripcion)
    regiones++

    for (const p of r.provincias) {
      const provincia = await upsertProvincia(p.codigo, p.descripcion, region.id)
      provincias++

      // Comunas de una misma provincia no dependen entre sí: se cargan en paralelo.
      await Promise.all(p.comunas.map((c) => upsertComuna(c.codigo, c.descripcion, provincia.id)))
      comunas += p.comunas.length
    }
  }

  console.log(`Geografía de Chile cargada: ${regiones} regiones, ${provincias} provincias, ${comunas} comunas.`)

  // Códigos oficiales usados por este seed, para detectar registros previos
  // que no correspondan a la división oficial (datos de prueba, duplicados,
  // etc.) — se reportan pero NUNCA se modifican ni eliminan automáticamente.
  const codigosOficiales = {
    regiones: new Set(REGIONES_CHILE.map((r) => r.codigo)),
    provincias: new Set(REGIONES_CHILE.flatMap((r) => r.provincias.map((p) => p.codigo))),
    comunas: new Set(REGIONES_CHILE.flatMap((r) => r.provincias.flatMap((p) => p.comunas.map((c) => c.codigo)))),
  }

  const [todasRegiones, todasProvincias, todasComunas] = await Promise.all([
    prisma.region.findMany({ where: { eliminadoEn: null } }),
    prisma.provincia.findMany({ where: { eliminadoEn: null } }),
    prisma.comuna.findMany({ where: { eliminadoEn: null } }),
  ])

  const huerfanas = {
    regiones: todasRegiones.filter((r) => !codigosOficiales.regiones.has(r.codigo)),
    provincias: todasProvincias.filter((p) => !codigosOficiales.provincias.has(p.codigo)),
    comunas: todasComunas.filter((c) => !codigosOficiales.comunas.has(c.codigo)),
  }

  const totalHuerfanas = huerfanas.regiones.length + huerfanas.provincias.length + huerfanas.comunas.length
  if (totalHuerfanas > 0) {
    console.log(`\nAtención: ${totalHuerfanas} registro(s) no coinciden con ningún código oficial (probablemente datos de prueba). No se modificaron:`)
    for (const r of huerfanas.regiones) console.log(`  - Región      #${r.id} codigo="${r.codigo}" "${r.descripcion}"`)
    for (const p of huerfanas.provincias) console.log(`  - Provincia   #${p.id} codigo="${p.codigo}" "${p.descripcion}"`)
    for (const c of huerfanas.comunas) console.log(`  - Comuna      #${c.id} codigo="${c.codigo}" "${c.descripcion}"`)
    console.log('Revisar manualmente si corresponde bloquearlos o eliminarlos (ver FKs antes de eliminar).')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
