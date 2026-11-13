// Backfill del Predio de origen en PalletLinea (2026-11-13).
//
// Las Recepciones cargadas antes de la migración 20261113120000 no guardaron el
// Predio por línea. El Excel original sí está en la BD (RecepcionAdjunto), y su
// columna "Productor" trae el código CSG del Predio: este script lo relee con
// el mismo Template de Carga y completa `pallet_lineas.predioId`.
//
// Correspondencia fila ↔ línea: por N° de pallet y, dentro del pallet, por
// orden (las líneas se crean en el orden de las filas del Excel). Solo se
// asigna si el pallet tiene exactamente las mismas cajas, en el mismo orden,
// que sus filas — si el pallet se editó después en Stock, se omite y se
// reporta. El Predio debe ser del mismo productor del pallet.
//
// Uso (desde fas-api):
//   npx tsx src/scripts/backfill-predio-pallet-lineas.ts            # simulación
//   npx tsx src/scripts/backfill-predio-pallet-lineas.ts --aplicar  # escribe
// En producción (contenedor):
//   node dist/scripts/backfill-predio-pallet-lineas.js [--aplicar]
import { prisma, prismaBase } from '../lib/prisma.js'
import { empresaContext } from '../lib/empresa-context.js'
import { cargarPrimeraHoja, leerFilasCrudas, resolverMapeoColumnas, type FilaExcelCruda } from '../modules/compras/recepciones/recepciones.excel.js'
import { findProductorYPredioByTexto } from '../modules/compras/recepciones/recepciones.repository.js'

interface Resumen {
  recepciones: number
  sinAdjuntoCompatible: string[]
  lineasAsignadas: number
  palletsOmitidos: string[]
  filasSinPredio: string[]
}

async function procesarRecepcion(recepcionId: number, r: Resumen, APLICAR: boolean) {
  const rec = await prisma.recepcion.findFirst({
    where: { id: recepcionId },
    select: {
      numero: true,
      templateCarga: { select: { tieneCabecera: true, filaCabecera: true, filaPrimerRegistro: true, campos: { select: { campo: true, columna: true } } } },
      adjuntos: { orderBy: [{ subidoEn: 'desc' }, { id: 'desc' }], select: { id: true, nombre: true, contenido: { select: { datos: true } } } },
      pallets: {
        where: { eliminadoEn: null },
        select: {
          numeroPallet: true,
          productorId: true,
          lineas: { orderBy: { id: 'asc' }, select: { id: true, cajas: true, predioId: true } },
        },
      },
    },
  })
  if (!rec) return
  r.recepciones++
  if (!rec.templateCarga) {
    r.sinAdjuntoCompatible.push(`${rec.numero}: sin Template de Carga`)
    return
  }

  // El adjunto que generó los pallets: el más reciente cuyas filas cuadran
  // (mismos N° de pallet) — los anteriores pueden ser intentos rechazados.
  const numerosPallet = new Set(rec.pallets.map((p) => p.numeroPallet))
  let filasPorPallet: Map<string, FilaExcelCruda[]> | null = null
  for (const a of rec.adjuntos) {
    if (!a.contenido) continue
    try {
      const hoja = await cargarPrimeraHoja(Buffer.from(a.contenido.datos))
      const { indicePorCampo, errores } = resolverMapeoColumnas(hoja, rec.templateCarga)
      if (errores.length > 0) continue
      const filas = leerFilasCrudas(hoja, rec.templateCarga, indicePorCampo)
      const mapa = new Map<string, FilaExcelCruda[]>()
      for (const f of filas) mapa.set(f.numeroPallet, [...(mapa.get(f.numeroPallet) ?? []), f])
      const coincide = [...numerosPallet].every((n) => mapa.has(n))
      if (coincide) {
        filasPorPallet = mapa
        break
      }
    } catch {
      // Adjunto ilegible: se prueba el siguiente.
    }
  }
  if (!filasPorPallet) {
    r.sinAdjuntoCompatible.push(`${rec.numero}: ningún Excel adjunto coincide con sus pallets`)
    return
  }

  for (const p of rec.pallets) {
    const pendientes = p.lineas.filter((l) => l.predioId == null)
    if (pendientes.length === 0) continue
    const filas = filasPorPallet.get(p.numeroPallet)!
    const cajasFilas = filas.map((f) => Number(f.cajas.replace(',', '.')))
    const mismasCajas = filas.length === p.lineas.length && p.lineas.every((l, i) => l.cajas === cajasFilas[i])
    if (!mismasCajas) {
      r.palletsOmitidos.push(`${rec.numero} pallet ${p.numeroPallet}: sus líneas no coinciden con el Excel (¿editado en Stock?)`)
      continue
    }
    for (let i = 0; i < p.lineas.length; i++) {
      const linea = p.lineas[i]!
      if (linea.predioId != null) continue
      const res = await findProductorYPredioByTexto(filas[i]!.productor)
      if (!res?.predio || res.predio.entidadId !== p.productorId) {
        r.filasSinPredio.push(`${rec.numero} pallet ${p.numeroPallet} fila ${filas[i]!.fila}: "${filas[i]!.productor}" no corresponde a un Predio del productor`)
        continue
      }
      if (APLICAR) await prismaBase.palletLinea.update({ where: { id: linea.id }, data: { predioId: res.predio.id } })
      r.lineasAsignadas++
    }
  }
}

export async function backfillPredioPalletLineas(opciones: { aplicar: boolean; empresaIds?: number[] }) {
  const APLICAR = opciones.aplicar
  const empresas = await prismaBase.empresa.findMany({
    where: opciones.empresaIds ? { id: { in: opciones.empresaIds } } : undefined,
    select: { id: true, razonSocial: true },
    orderBy: { id: 'asc' },
  })
  const resultados: Array<Resumen & { empresaId: number }> = []
  for (const e of empresas) {
    const r: Resumen = { recepciones: 0, sinAdjuntoCompatible: [], lineasAsignadas: 0, palletsOmitidos: [], filasSinPredio: [] }
    await empresaContext.run({ empresaId: e.id }, async () => {
      const recepciones = await prisma.recepcion.findMany({
        where: { pallets: { some: { eliminadoEn: null, lineas: { some: { predioId: null } } } } },
        select: { id: true },
        orderBy: { id: 'asc' },
      })
      for (const { id } of recepciones) await procesarRecepcion(id, r, APLICAR)
    })
    resultados.push({ ...r, empresaId: e.id })
    console.log(`\n=== ${e.razonSocial} (empresa ${e.id}) ===`)
    console.log(`Recepciones revisadas: ${r.recepciones}`)
    console.log(`Líneas ${APLICAR ? 'actualizadas' : 'a actualizar'}: ${r.lineasAsignadas}`)
    for (const [titulo, lista] of [
      ['Recepciones sin Excel compatible', r.sinAdjuntoCompatible],
      ['Pallets omitidos', r.palletsOmitidos],
      ['Filas sin Predio', r.filasSinPredio],
    ] as const) {
      if (lista.length === 0) continue
      console.log(`${titulo} (${lista.length}):`)
      for (const x of lista) console.log(`  - ${x}`)
    }
  }
  if (!APLICAR) console.log('\nSimulación: no se escribió nada. Ejecuta con --aplicar para guardar.')
  return resultados
}

// Ejecución directa (no al importarlo desde un test).
if (process.argv[1] && /backfill-predio-pallet-lineas\.(ts|js)$/.test(process.argv[1])) {
  backfillPredioPalletLineas({ aplicar: process.argv.includes('--aplicar') })
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prismaBase.$disconnect()
  })
}
