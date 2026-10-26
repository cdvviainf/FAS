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
  compararSubconjuntoConReserva,
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

// Entidad candidata a "Emisor de la Guía" — productor/planta del embarque.
export interface EntidadEmisorEmbarque {
  id: number
  codigo: string
  descripcion: string
  razonSocial: string
}

export interface ResultadoReconciliacion {
  estado: 'OK' | 'DISCREPANCIA'
  discrepancias: string[]
  // N° de Pallet que cubre este archivo (subconjunto de los reservados) — se
  // usa para validar la unión de archivos al despachar (packing parcializado).
  numerosPallet: string[]
  // Termógrafos declarados en el archivo (2026-10-12): valores distintos no
  // vacíos de la columna Termógrafo (opcional, puede variar por pallet). Se
  // conserva por compatibilidad; el dato por pallet vive en datosPorPallet.
  termografos: string[]
  // Datos por pallet declarados en el archivo (guía/emisor 2026-10-23;
  // termógrafo/temperatura 2026-10-25), consistentes dentro del pallet. Solo
  // pallets que declararon algún dato; cada campo es `undefined` cuando su
  // columna no se declaró (no se toca ese dato). El repositorio lo persiste SOLO
  // si la reconciliación quedó en estado OK.
  datosPorPallet: DatoPalletReconciliado[]
}

// Datos capturados por pallet en la reconciliación del Packing List.
export interface DatoPalletReconciliado {
  numeroPallet: string
  numeroGuia?: string
  emisorGuiaId?: number
  termografo?: string
  temperatura?: number
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

    // Termógrafo (2026-10-12): opcional, pero si viene se valida el largo.
    if (f.termografo && f.termografo.trim().length > 60) {
      errores.push(`Fila ${f.fila}: el Termógrafo "${f.termografo}" supera los 60 caracteres`)
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

// ─── Datos por pallet (guía 2026-10-23; termógrafo/temperatura 2026-10-25) ───
// Resuelve, para cada pallet, los datos declarados en el Excel: N° de guía,
// emisor (acotado a los productores/plantas del embarque), termógrafo y
// temperatura. Todas las columnas son opcionales (celda vacía = no se declara).
// Dentro de un mismo pallet deben ser consistentes: si distintas filas traen
// valores distintos de una misma columna, es discrepancia (ese pallet no se
// persiste). Cada columna es independiente: `undefined` = NO declarada (no se
// toca el valor existente del pallet); un valor = declarada. Nunca se escribe
// null implícito por una celda vacía (QA-APL-003).
function resolverDatosPorPallet(
  filas: FilaPackingListCruda[],
  entidadesEmisor: EntidadEmisorEmbarque[],
): { datosPorPallet: DatoPalletReconciliado[]; errores: string[] } {
  const errores: string[] = []

  const norm = (s: string) => s.trim().toLowerCase()
  // "código - nombre" (formato del dropdown) o solo el código/nombre.
  const codigoAntes = (s: string) => (s.includes(' - ') ? s.split(' - ')[0] : s).trim().toLowerCase()
  const matchEmisor = (texto: string): EntidadEmisorEmbarque | null => {
    const t = norm(texto)
    const tc = codigoAntes(texto)
    return (
      entidadesEmisor.find(
        (e) => norm(e.codigo) === tc || norm(e.codigo) === t || norm(e.descripcion) === t || norm(e.razonSocial) === t,
      ) ?? null
    )
  }

  // Valores distintos no vacíos de una columna dentro del pallet.
  const distintos = (filasPallet: FilaPackingListCruda[], get: (f: FilaPackingListCruda) => string) =>
    new Set(filasPallet.map((f) => (get(f) ?? '').trim()).filter(Boolean))

  // Agrupar las filas por pallet para exigir consistencia dentro del pallet.
  const porPallet = new Map<string, FilaPackingListCruda[]>()
  for (const f of filas) {
    const arr = porPallet.get(f.numeroPallet) ?? []
    arr.push(f)
    porPallet.set(f.numeroPallet, arr)
  }

  const datosPorPallet: DatoPalletReconciliado[] = []

  for (const [numeroPallet, filasPallet] of porPallet) {
    const numerosGuia = distintos(filasPallet, (f) => f.numeroGuia)
    const emisoresTexto = distintos(filasPallet, (f) => f.emisorGuia)
    const termografosPallet = distintos(filasPallet, (f) => f.termografo)
    const temperaturasTexto = distintos(filasPallet, (f) => f.temperatura)

    if (
      numerosGuia.size === 0 && emisoresTexto.size === 0 &&
      termografosPallet.size === 0 && temperaturasTexto.size === 0
    ) continue // pallet sin ningún dato declarado

    // Consistencia: una sola columna con valor único por pallet.
    let inconsistente = false
    const exigirUnico = (set: Set<string>, etiqueta: string) => {
      if (set.size > 1) {
        errores.push(`Pallet "${numeroPallet}": el Packing List trae ${etiqueta} distintos en sus filas (${[...set].join(', ')})`)
        inconsistente = true
      }
    }
    exigirUnico(numerosGuia, 'N° de Guía')
    exigirUnico(emisoresTexto, 'Emisores de la Guía')
    exigirUnico(termografosPallet, 'Termógrafos')
    exigirUnico(temperaturasTexto, 'Temperaturas')
    if (inconsistente) continue

    let emisorGuiaId: number | undefined
    if (emisoresTexto.size === 1) {
      const texto = [...emisoresTexto][0]
      const emisor = matchEmisor(texto)
      if (!emisor) {
        errores.push(`Pallet "${numeroPallet}": el Emisor de la Guía "${texto}" no corresponde a un productor o planta de este Embarque`)
        continue
      }
      emisorGuiaId = emisor.id
    }

    let temperatura: number | undefined
    if (temperaturasTexto.size === 1) {
      // Acepta coma o punto decimal (ej. "0,5" o "-0.5").
      const n = Number([...temperaturasTexto][0].replace(',', '.'))
      if (!Number.isFinite(n)) {
        errores.push(`Pallet "${numeroPallet}": la Temperatura "${[...temperaturasTexto][0]}" no es un número válido`)
        continue
      }
      temperatura = n
    }

    // Solo se incluye lo declarado: columna vacía → undefined → no se toca.
    datosPorPallet.push({
      numeroPallet,
      numeroGuia: numerosGuia.size === 1 ? [...numerosGuia][0] : undefined,
      emisorGuiaId,
      termografo: termografosPallet.size === 1 ? [...termografosPallet][0] : undefined,
      temperatura,
    })
  }

  return { datosPorPallet, errores }
}

// ─── Entrada principal ─────────────────────────────────────────────────────

export async function reconciliarPackingList(
  template: TemplateParaLectura,
  buffer: Buffer,
  palletsStock: PalletStockParaComparar[],
  entidadesEmisor: EntidadEmisorEmbarque[] = [],
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

  // Termógrafo(s) del archivo (2026-10-12): valores distintos no vacíos de la
  // columna (opcional; un contenedor puede llevar más de uno).
  const termografos = [...new Set(filasCrudas.map((f) => f.termografo.trim()).filter(Boolean))]

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
  // Packing parcializado (2026-09-28): el archivo cubre un subconjunto — solo
  // se rechazan los "ajenos" (no reservados). La cobertura total se valida en
  // la unión de archivos al despachar (embarques.repository.confirmarDespacho).
  const discrepancias = [...compararSubconjuntoConReserva(numerosExcel, numerosReservados)]

  // El detalle se compara solo contra los pallets del stock que el archivo
  // realmente declara (subconjunto), no contra todos los reservados.
  const declarados = new Set(numerosExcel)
  const stockDeclarado = palletsStock.filter((p) => declarados.has(p.numeroPallet))

  const filasPorPallet = new Map<string, FilaPackingListParaComparar[]>()
  for (const f of filas) {
    const arr = filasPorPallet.get(f.numeroPallet) ?? []
    arr.push(f)
    filasPorPallet.set(f.numeroPallet, arr)
  }
  discrepancias.push(...compararDetallePalletsConStock(filasPorPallet, stockDeclarado))

  // Datos por pallet (2026-10-23/25): guía + emisor (acotado a productores/
  // plantas del embarque) + termógrafo + temperatura. Sus inconsistencias se
  // suman como discrepancias; solo los pallets consistentes se devuelven para
  // persistir.
  const { datosPorPallet, errores: erroresDatos } = resolverDatosPorPallet(filasCrudas, entidadesEmisor)
  discrepancias.push(...erroresDatos)

  return discrepancias.length > 0
    ? { estado: 'DISCREPANCIA', discrepancias, numerosPallet: numerosExcel, termografos, datosPorPallet }
    : { estado: 'OK', discrepancias: [], numerosPallet: numerosExcel, termografos, datosPorPallet }
}
