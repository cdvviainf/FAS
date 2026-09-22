// Motor de reconciliación de Packing List (compras.md §9.3, cierra
// EP-QA-003) — a diferencia del motor de Recepción (recepciones.motor.ts),
// este NO inserta nada: los pallets ya existen en Stock, reservados al
// Embarque desde la pestaña "Seleccionar Pallets". Solo compara y devuelve un
// resultado (OK o DISCREPANCIA con el detalle), que el repositorio persiste
// tal cual (embarques.repository.ts guardarPackingList).
//
//   Etapa 1 — Template: el mapeo de columnas realmente existe en este Excel.
//   Etapa 2 — Filas: las 10 columnas (todas obligatorias, ver
//             templates-carga.types.ts CAMPOS_POR_TIPO.PACKING_LIST) vienen
//             completas y con formato válido, sin tocar la BD.
//   Etapa 3 — Maestros: cada valor de texto resuelve a un registro real.
//   Etapa 4 — Comparación (compras.md §9.3, embarques.comparacion.ts): N° de
//             Pallet del PL = reservados al Embarque, y el detalle de cada
//             pallet coincidente = el detalle en Stock.
//
// Reusa los lookups de texto->ID (findEspecieByTexto, etc.) de
// recepciones.repository.ts — son consultas genéricas contra los maestros,
// sin nada específico de Recepción; duplicarlas arriesgaría que el criterio
// de match (case-insensitive contra código/descripción) diverja entre ambos
// módulos sin que nadie lo note.
import { ValidationError } from '../../../shared/errors.js'
import * as recepcionesRepo from '../../compras/recepciones/recepciones.repository.js'
import { parseFechaEmbalajeTexto, FECHA_INVALIDA } from '../../compras/recepciones/recepciones.motor.js'
import { cargarPrimeraHoja, resolverMapeoColumnas, leerFilasPackingList, type FilaPackingListCruda } from './embarques.excel.js'
import {
  compararNumerosPalletConReserva,
  compararDetallePalletsConStock,
  type FilaPackingListParaComparar,
  type PalletStockParaComparar,
} from './embarques.comparacion.js'

interface TemplateParaLectura {
  tieneCabecera: boolean
  filaCabecera: number | null
  filaPrimerRegistro: number
  campos: Array<{ campo: string; columna: string }>
}

export interface ResultadoReconciliacion {
  estado: 'OK' | 'DISCREPANCIA'
  discrepancias: string[]
}

// ─── Etapa 2: filas completas y con datos válidos (sin BD) ────────────────

function validarFilasCompletas(filas: FilaPackingListCruda[]): string[] {
  const errores: string[] = []
  for (const f of filas) {
    if (!f.numeroPallet) errores.push(`Fila ${f.fila}: falta el N° de Pallet`)
    if (!f.especie) errores.push(`Fila ${f.fila}: falta la Especie`)
    if (!f.variedad) errores.push(`Fila ${f.fila}: falta la Variedad`)
    if (!f.categoria) errores.push(`Fila ${f.fila}: falta la Categoría`)
    if (!f.calibre) errores.push(`Fila ${f.fila}: falta el Calibre`)
    if (!f.articulo) errores.push(`Fila ${f.fila}: falta el Artículo/Embalaje`)
    if (!f.productor) errores.push(`Fila ${f.fila}: falta el Productor`)
    if (!f.etiqueta) errores.push(`Fila ${f.fila}: falta la Etiqueta`)
    if (!f.fechaEmbalaje) errores.push(`Fila ${f.fila}: falta la Fecha de Embalaje`)

    if (!f.cajas) {
      errores.push(`Fila ${f.fila}: faltan las Cajas`)
    } else {
      const cajas = Number(f.cajas.replace(',', '.'))
      if (!Number.isFinite(cajas) || !Number.isInteger(cajas) || cajas <= 0) {
        errores.push(`Fila ${f.fila}: Cajas "${f.cajas}" no es un número entero válido`)
      }
    }
  }
  return errores
}

// ─── Etapa 3: resolución texto -> ID contra los maestros ──────────────────

async function resolverContraMaestros(filas: FilaPackingListCruda[]): Promise<{ filas: FilaPackingListParaComparar[]; errores: string[] }> {
  const cacheEspecie = new Map<string, Awaited<ReturnType<typeof recepcionesRepo.findEspecieByTexto>>>()
  const cacheVariedad = new Map<string, Awaited<ReturnType<typeof recepcionesRepo.findVariedadByTexto>>>()
  const cacheCategoria = new Map<string, Awaited<ReturnType<typeof recepcionesRepo.findCategoriaByTexto>>>()
  const cacheCalibre = new Map<string, Awaited<ReturnType<typeof recepcionesRepo.findCalibreByTexto>>>()
  const cacheArticulo = new Map<string, Awaited<ReturnType<typeof recepcionesRepo.findArticuloByTexto>>>()
  const cacheProductor = new Map<string, Awaited<ReturnType<typeof recepcionesRepo.findProductorByTexto>>>()
  const cacheEtiqueta = new Map<string, Awaited<ReturnType<typeof recepcionesRepo.findEtiquetaByTexto>>>()

  const errores: string[] = []
  const resueltas: FilaPackingListParaComparar[] = []

  for (const cruda of filas) {
    const erroresFila: string[] = []

    const keyEspecie = cruda.especie.toLowerCase()
    if (!cacheEspecie.has(keyEspecie)) cacheEspecie.set(keyEspecie, await recepcionesRepo.findEspecieByTexto(cruda.especie))
    const especie = cacheEspecie.get(keyEspecie)
    if (!especie) erroresFila.push(`Fila ${cruda.fila}: Especie "${cruda.especie}" no existe en el maestro`)

    let variedad: Awaited<ReturnType<typeof recepcionesRepo.findVariedadByTexto>> = null
    let categoria: Awaited<ReturnType<typeof recepcionesRepo.findCategoriaByTexto>> = null
    let calibre: Awaited<ReturnType<typeof recepcionesRepo.findCalibreByTexto>> = null
    if (especie) {
      const keyVariedad = `${especie.id}:${cruda.variedad.toLowerCase()}`
      if (!cacheVariedad.has(keyVariedad)) cacheVariedad.set(keyVariedad, await recepcionesRepo.findVariedadByTexto(especie.id, cruda.variedad))
      variedad = cacheVariedad.get(keyVariedad) ?? null
      if (!variedad) erroresFila.push(`Fila ${cruda.fila}: Variedad "${cruda.variedad}" no existe para la especie "${especie.descripcion}"`)

      const keyCategoria = `${especie.id}:${cruda.categoria.toLowerCase()}`
      if (!cacheCategoria.has(keyCategoria)) cacheCategoria.set(keyCategoria, await recepcionesRepo.findCategoriaByTexto(especie.id, cruda.categoria))
      categoria = cacheCategoria.get(keyCategoria) ?? null
      if (!categoria) erroresFila.push(`Fila ${cruda.fila}: Categoría "${cruda.categoria}" no existe para la especie "${especie.descripcion}"`)

      const keyCalibre = `${especie.id}:${cruda.calibre.toLowerCase()}`
      if (!cacheCalibre.has(keyCalibre)) cacheCalibre.set(keyCalibre, await recepcionesRepo.findCalibreByTexto(especie.id, cruda.calibre))
      calibre = cacheCalibre.get(keyCalibre) ?? null
      if (!calibre) erroresFila.push(`Fila ${cruda.fila}: Calibre "${cruda.calibre}" no existe para la especie "${especie.descripcion}"`)
    }

    const keyArticulo = cruda.articulo.toLowerCase()
    if (!cacheArticulo.has(keyArticulo)) cacheArticulo.set(keyArticulo, await recepcionesRepo.findArticuloByTexto(cruda.articulo))
    const articulo = cacheArticulo.get(keyArticulo)
    if (!articulo) erroresFila.push(`Fila ${cruda.fila}: Artículo/Embalaje "${cruda.articulo}" no existe en el maestro`)

    const keyProductor = cruda.productor.toLowerCase()
    if (!cacheProductor.has(keyProductor)) cacheProductor.set(keyProductor, await recepcionesRepo.findProductorByTexto(cruda.productor))
    const productor = cacheProductor.get(keyProductor)
    if (!productor) erroresFila.push(`Fila ${cruda.fila}: Productor "${cruda.productor}" no existe en el maestro`)

    const keyEtiqueta = cruda.etiqueta.toLowerCase()
    if (!cacheEtiqueta.has(keyEtiqueta)) cacheEtiqueta.set(keyEtiqueta, await recepcionesRepo.findEtiquetaByTexto(cruda.etiqueta))
    const etiqueta = cacheEtiqueta.get(keyEtiqueta)
    if (!etiqueta) erroresFila.push(`Fila ${cruda.fila}: Etiqueta "${cruda.etiqueta}" no existe en el maestro`)

    const fechaParseada = parseFechaEmbalajeTexto(cruda.fechaEmbalaje)
    if (fechaParseada === FECHA_INVALIDA) {
      erroresFila.push(`Fila ${cruda.fila}: Fecha de Embalaje "${cruda.fechaEmbalaje}" no es una fecha válida (usa dd-mm-aaaa)`)
    }

    if (erroresFila.length > 0) {
      errores.push(...erroresFila)
      continue
    }

    const cajas = Number(cruda.cajas.replace(',', '.'))
    const e = especie!, v = variedad!, c = categoria!, cal = calibre!, art = articulo!, prod = productor!
    resueltas.push({
      fila: cruda.fila,
      numeroPallet: cruda.numeroPallet,
      especieId: e.id,
      variedadId: v.id,
      categoriaId: c.id,
      articuloId: art.id,
      calibreId: cal.id,
      cajas,
      productorId: prod.id,
      comboLabel: `${e.descripcion} / ${v.descripcion} / ${c.descripcion} / ${art.descripcion} / ${cal.descripcion}`,
    })
  }

  return { filas: resueltas, errores }
}

// ─── Entrada principal ─────────────────────────────────────────────────────

export async function reconciliarPackingList(
  template: TemplateParaLectura,
  buffer: Buffer,
  palletsStock: PalletStockParaComparar[],
): Promise<ResultadoReconciliacion> {
  const hoja = await cargarPrimeraHoja(buffer)

  // Etapa 1 — Template: columnas mapeadas que de verdad existen en el Excel.
  const { indicePorCampo, errores: erroresMapeo } = resolverMapeoColumnas(hoja, template)
  if (erroresMapeo.length > 0) {
    throw new ValidationError('Etapa 1 — El Template de Carga no coincide con este Excel', { diferencias: erroresMapeo })
  }

  const filasCrudas = leerFilasPackingList(hoja, template, indicePorCampo)

  // Etapa 2 — Filas: completas y con formato válido, sin tocar la BD.
  const erroresFilas = validarFilasCompletas(filasCrudas)
  if (erroresFilas.length > 0) {
    throw new ValidationError('Etapa 2 — Hay filas incompletas o con datos inválidos', { diferencias: erroresFilas })
  }

  // Etapa 3 — Maestros: cada valor resuelve a un registro real.
  const { filas, errores: erroresMaestros } = await resolverContraMaestros(filasCrudas)
  if (erroresMaestros.length > 0) {
    throw new ValidationError('Etapa 3 — Hay datos que no existen en los maestros', { diferencias: erroresMaestros })
  }

  // Etapa 4 — Comparación (compras.md §9.3): errores de negocio, no de
  // formato — se persisten como DISCREPANCIA en vez de abortar, para que el
  // usuario vea exactamente qué no cuadra y pueda reintentar.
  const numerosExcel = [...new Set(filas.map((f) => f.numeroPallet))]
  const numerosReservados = palletsStock.map((p) => p.numeroPallet)
  const discrepancias = [...compararNumerosPalletConReserva(numerosExcel, numerosReservados)]

  const filasPorPallet = new Map<string, FilaPackingListParaComparar[]>()
  for (const f of filas) {
    const arr = filasPorPallet.get(f.numeroPallet) ?? []
    arr.push(f)
    filasPorPallet.set(f.numeroPallet, arr)
  }
  discrepancias.push(...compararDetallePalletsConStock(filasPorPallet, palletsStock))

  return discrepancias.length > 0 ? { estado: 'DISCREPANCIA', discrepancias } : { estado: 'OK', discrepancias: [] }
}
