// Motor de validación / carga de Recepción (compras.md §7). Orquesta:
// leer el Excel -> resolver texto contra maestros -> (si hay OC) comparar
// contra las líneas de la OC -> crear Pallet/PalletLinea o rechazar.
// Todo o nada: cualquier fila sin resolver o cualquier diferencia contra la
// OC aborta la carga completa (no se genera ningún pallet).
import { ValidationError } from '../../../shared/errors.js'
import * as repo from './recepciones.repository.js'
import { leerFilasExcel, type FilaExcelCruda } from './recepciones.excel.js'
import { compararLineasOcConExcel } from './recepciones.comparacion.js'

interface FilaResuelta {
  fila: number
  numeroPallet: string
  especieId: number
  especieLabel: string
  variedadId: number
  categoriaId: number
  articuloId: number
  calibreId: number
  calibreLabel: string
  cajas: number
  productorId: number
  comboLabel: string // "especie / variedad / categoría / artículo", para mensajes
  comboKey: string // especieId-variedadId-categoriaId-articuloId, para agrupar
}

interface RecepcionParaMotor {
  id: number
  ordenCompraId: number | null
  templateCargaId: number | null
  templateCarga: {
    tieneCabecera: boolean
    filaCabecera: number | null
    filaPrimerRegistro: number
    campos: Array<{ campo: string; columna: string }>
  } | null
}

// ─── Resolución texto -> ID (con caché en memoria del propio archivo) ────────

async function resolverFilas(filasCrudas: FilaExcelCruda[]) {
  const cacheEspecie = new Map<string, Awaited<ReturnType<typeof repo.findEspecieByTexto>>>()
  const cacheVariedad = new Map<string, Awaited<ReturnType<typeof repo.findVariedadByTexto>>>()
  const cacheCategoria = new Map<string, Awaited<ReturnType<typeof repo.findCategoriaByTexto>>>()
  const cacheCalibre = new Map<string, Awaited<ReturnType<typeof repo.findCalibreByTexto>>>()
  const cacheArticulo = new Map<string, Awaited<ReturnType<typeof repo.findArticuloByTexto>>>()
  const cacheProductor = new Map<string, Awaited<ReturnType<typeof repo.findProductorByTexto>>>()

  const errores: string[] = []
  const filas: FilaResuelta[] = []

  for (const cruda of filasCrudas) {
    const erroresFila: string[] = []

    if (!cruda.numeroPallet) erroresFila.push(`Fila ${cruda.fila}: falta el N° de Pallet`)

    const keyEspecie = cruda.especie.toLowerCase()
    if (!cacheEspecie.has(keyEspecie)) cacheEspecie.set(keyEspecie, await repo.findEspecieByTexto(cruda.especie))
    const especie = cacheEspecie.get(keyEspecie)
    if (!especie) erroresFila.push(`Fila ${cruda.fila}: Especie "${cruda.especie}" no existe en el maestro`)

    let variedad: Awaited<ReturnType<typeof repo.findVariedadByTexto>> = null
    let categoria: Awaited<ReturnType<typeof repo.findCategoriaByTexto>> = null
    let calibre: Awaited<ReturnType<typeof repo.findCalibreByTexto>> = null
    if (especie) {
      const keyVariedad = `${especie.id}:${cruda.variedad.toLowerCase()}`
      if (!cacheVariedad.has(keyVariedad)) cacheVariedad.set(keyVariedad, await repo.findVariedadByTexto(especie.id, cruda.variedad))
      variedad = cacheVariedad.get(keyVariedad) ?? null
      if (!variedad) erroresFila.push(`Fila ${cruda.fila}: Variedad "${cruda.variedad}" no existe para la especie "${especie.descripcion}"`)

      const keyCategoria = `${especie.id}:${cruda.categoria.toLowerCase()}`
      if (!cacheCategoria.has(keyCategoria)) cacheCategoria.set(keyCategoria, await repo.findCategoriaByTexto(especie.id, cruda.categoria))
      categoria = cacheCategoria.get(keyCategoria) ?? null
      if (!categoria) erroresFila.push(`Fila ${cruda.fila}: Categoría "${cruda.categoria}" no existe para la especie "${especie.descripcion}"`)

      const keyCalibre = `${especie.id}:${cruda.calibre.toLowerCase()}`
      if (!cacheCalibre.has(keyCalibre)) cacheCalibre.set(keyCalibre, await repo.findCalibreByTexto(especie.id, cruda.calibre))
      calibre = cacheCalibre.get(keyCalibre) ?? null
      if (!calibre) erroresFila.push(`Fila ${cruda.fila}: Calibre "${cruda.calibre}" no existe para la especie "${especie.descripcion}"`)
    }

    const keyArticulo = cruda.articulo.toLowerCase()
    if (!cacheArticulo.has(keyArticulo)) cacheArticulo.set(keyArticulo, await repo.findArticuloByTexto(cruda.articulo))
    const articulo = cacheArticulo.get(keyArticulo)
    if (!articulo) erroresFila.push(`Fila ${cruda.fila}: Artículo/Embalaje "${cruda.articulo}" no existe en el maestro`)

    const keyProductor = cruda.productor.toLowerCase()
    if (!cacheProductor.has(keyProductor)) cacheProductor.set(keyProductor, await repo.findProductorByTexto(cruda.productor))
    const productor = cacheProductor.get(keyProductor)
    if (!productor) erroresFila.push(`Fila ${cruda.fila}: Productor "${cruda.productor}" no existe en el maestro`)

    const cajas = Number(cruda.cajas.replace(',', '.'))
    if (!Number.isFinite(cajas) || !Number.isInteger(cajas) || cajas <= 0) {
      erroresFila.push(`Fila ${cruda.fila}: Cajas "${cruda.cajas}" no es un número entero válido`)
    }

    if (erroresFila.length > 0) {
      errores.push(...erroresFila)
      continue
    }

    // A esta altura especie/variedad/categoria/calibre/articulo/productor están
    // garantizados (si alguno faltara, erroresFila no estaría vacío arriba).
    const e = especie!, v = variedad!, c = categoria!, cal = calibre!, art = articulo!, prod = productor!
    filas.push({
      fila: cruda.fila,
      numeroPallet: cruda.numeroPallet,
      especieId: e.id,
      especieLabel: e.descripcion,
      variedadId: v.id,
      categoriaId: c.id,
      articuloId: art.id,
      calibreId: cal.id,
      calibreLabel: cal.descripcion,
      cajas,
      productorId: prod.id,
      comboLabel: `${e.descripcion} / ${v.descripcion} / ${c.descripcion} / ${art.descripcion}`,
      comboKey: `${e.id}-${v.id}-${c.id}-${art.id}`,
    })
  }

  return { filas, errores }
}

// ─── Agrupación en pallets (compras.md §4.5: un pallet puede tener varias líneas) ─

function agruparEnPallets(filas: FilaResuelta[]) {
  const porPallet = new Map<string, FilaResuelta[]>()
  for (const f of filas) {
    const arr = porPallet.get(f.numeroPallet) ?? []
    arr.push(f)
    porPallet.set(f.numeroPallet, arr)
  }

  const errores: string[] = []
  const pallets: Array<{
    numeroPallet: string
    productorId: number
    lineas: Array<{ especieId: number; variedadId: number; categoriaId: number; articuloId: number; calibreId: number; cajas: number }>
  }> = []

  for (const [numeroPallet, lineasDelPallet] of porPallet) {
    const productores = new Set(lineasDelPallet.map((l) => l.productorId))
    if (productores.size > 1) {
      errores.push(`Pallet "${numeroPallet}": trae más de un Productor distinto entre sus filas — un pallet debe tener un único productor`)
      continue
    }
    pallets.push({
      numeroPallet,
      productorId: lineasDelPallet[0].productorId,
      lineas: lineasDelPallet.map((l) => ({
        especieId: l.especieId,
        variedadId: l.variedadId,
        categoriaId: l.categoriaId,
        articuloId: l.articuloId,
        calibreId: l.calibreId,
        cajas: l.cajas,
      })),
    })
  }

  return { pallets, errores }
}

// ─── Comparación contra OC (compras.md §7.1/§7.2) ─────────────────────────────

// Chequeo optimista, sin lock — da feedback rápido al usuario en el caso
// común. No es la autoridad final: la Orden de Compra puede seguir
// editándose entre este chequeo y la transacción de creación de pallets, así
// que repo.crearPalletsYValidar vuelve a leer la OC y a comparar (misma
// función pura) bajo lock antes de confirmar (QA-RCV-007).
async function compararContraOc(ordenCompraId: number, filas: FilaResuelta[]): Promise<string[]> {
  const oc = await repo.getOrdenCompraConLineas(ordenCompraId)
  if (!oc) throw new ValidationError('La Orden de Compra de esta Recepción ya no existe')
  return compararLineasOcConExcel(oc.lineas, filas)
}

// ─── Entrada principal ─────────────────────────────────────────────────────

export async function procesarCargaExcel(recepcion: RecepcionParaMotor, buffer: Buffer) {
  if (!recepcion.templateCargaId || !recepcion.templateCarga) {
    throw new ValidationError('Esta Recepción no tiene un Template de Carga asignado — selecciona uno antes de subir el Excel')
  }

  const filasCrudas = await leerFilasExcel(buffer, recepcion.templateCarga)
  const { filas, errores: erroresResolucion } = await resolverFilas(filasCrudas)
  if (erroresResolucion.length > 0) {
    throw new ValidationError('No se pudo procesar el archivo: hay datos que no coinciden con los maestros', {
      diferencias: erroresResolucion,
    })
  }

  const { pallets, errores: erroresAgrupacion } = agruparEnPallets(filas)
  if (erroresAgrupacion.length > 0) {
    throw new ValidationError('No se pudo procesar el archivo', { diferencias: erroresAgrupacion })
  }

  const origen: 'COMPRA' | 'CONSIGNACION' = recepcion.ordenCompraId ? 'COMPRA' : 'CONSIGNACION'

  if (recepcion.ordenCompraId) {
    const diferencias = await compararContraOc(recepcion.ordenCompraId, filas)
    if (diferencias.length > 0) {
      throw new ValidationError('No coincide la OC con la carga', { diferencias })
    }
  }

  // Todo cuadra (o no hay OC contra qué comparar): se cargan los pallets.
  // `filas` viaja también para que repo.crearPalletsYValidar pueda re-hacer
  // esta misma comparación bajo lock, contra una lectura fresca de la OC
  // (QA-RCV-007) — este resultado optimista de arriba no es la autoridad final.
  const recepcionActualizada = await repo.crearPalletsYValidar(recepcion.id, origen, recepcion.ordenCompraId, filas, pallets)
  return {
    recepcion: recepcionActualizada,
    resumen: { pallets: pallets.length, cajas: filas.reduce((a, f) => a + f.cajas, 0) },
  }
}
