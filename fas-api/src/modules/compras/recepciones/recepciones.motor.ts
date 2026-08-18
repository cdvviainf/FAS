// Motor de validación / carga de Recepción (compras.md §7), en 4 etapas
// secuenciales — cada una junta TODOS sus errores antes de decidir si
// aborta (nunca corta en el primer fallo dentro de una etapa), pero una
// etapa con errores sí impide pasar a la siguiente (no tiene sentido buscar
// maestros para una fila que ni siquiera trae Especie).
//
//   Etapa 1 — Template: el mapeo de columnas del Template de Carga
//             realmente existe en este Excel.
//   Etapa 2 — Filas: cada fila trae los 8 campos completos y con formato
//             válido (sin tocar la BD todavía).
//   Etapa 3 — Maestros: cada valor de texto resuelve a un registro real
//             (especie/variedad/categoría/artículo/calibre/productor), más
//             la consistencia de agrupación en pallets (compras.md §4.5).
//             Si hay OC, además se compara contra sus líneas (§7.1/§7.2).
//   Etapa 4 — Inserción: todo cuadró — se crean Pallet/PalletLinea y se
//             actualizan los estados, todo en una transacción (todo o
//             nada, §7.3). Vive en recepciones.repository.ts porque
//             necesita correr dentro de la transacción/lock.
import { ValidationError } from '../../../shared/errors.js'
import * as repo from './recepciones.repository.js'
import { cargarPrimeraHoja, resolverMapeoColumnas, leerFilasCrudas, type FilaExcelCruda } from './recepciones.excel.js'
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

// ─── Etapa 2: filas completas y con datos válidos (sin BD) ────────────────

function validarFilasCompletas(filasCrudas: FilaExcelCruda[]): string[] {
  const errores: string[] = []
  for (const f of filasCrudas) {
    if (!f.numeroPallet) errores.push(`Fila ${f.fila}: falta el N° de Pallet`)
    if (!f.especie) errores.push(`Fila ${f.fila}: falta la Especie`)
    if (!f.variedad) errores.push(`Fila ${f.fila}: falta la Variedad`)
    if (!f.categoria) errores.push(`Fila ${f.fila}: falta la Categoría`)
    if (!f.articulo) errores.push(`Fila ${f.fila}: falta el Artículo/Embalaje`)
    if (!f.calibre) errores.push(`Fila ${f.fila}: falta el Calibre`)
    if (!f.productor) errores.push(`Fila ${f.fila}: falta el Productor`)

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

// ─── Etapa 3a: resolución texto -> ID contra los maestros ─────────────────
// Asume que la Etapa 2 ya pasó limpia: todo campo llega no-vacío y `cajas`
// ya es un entero válido — acá solo se valida que el valor exista en BD.

async function resolverContraMaestros(filasCrudas: FilaExcelCruda[]): Promise<{ filas: FilaResuelta[]; errores: string[] }> {
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

    const keyEspecie = cruda.especie.toLowerCase()
    if (!cacheEspecie.has(keyEspecie)) cacheEspecie.set(keyEspecie, await repo.findEspecieByTexto(cruda.especie))
    const especie = cacheEspecie.get(keyEspecie)
    if (!especie) erroresFila.push(`Fila ${cruda.fila}: Especie "${cruda.especie}" no existe en el maestro`)

    // Variedad/Categoría/Calibre están scoped por especie — sin especie
    // resuelta no hay contra qué buscarlos, así que se saltan (ya se
    // reportó el problema de raíz arriba; no tiene sentido duplicarlo tres
    // veces más para la misma fila).
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

    if (erroresFila.length > 0) {
      errores.push(...erroresFila)
      continue
    }

    // Etapa 2 ya garantizó formato; acá solo falta el parseo final.
    const cajas = Number(cruda.cajas.replace(',', '.'))
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

// ─── Etapa 3b: agrupación en pallets (compras.md §4.5: un pallet puede tener varias líneas) ─

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

// ─── Etapa 3c: comparación contra OC (compras.md §7.1/§7.2) ───────────────

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
  const template = recepcion.templateCarga

  const hoja = await cargarPrimeraHoja(buffer)

  // Etapa 1 — Template: columnas mapeadas que de verdad existen en el Excel.
  const { indicePorCampo, errores: erroresMapeo } = resolverMapeoColumnas(hoja, template)
  if (erroresMapeo.length > 0) {
    throw new ValidationError('Etapa 1 — El Template de Carga no coincide con este Excel', { diferencias: erroresMapeo })
  }

  const filasCrudas = leerFilasCrudas(hoja, template, indicePorCampo)

  // Etapa 2 — Filas: completas y con formato válido, sin tocar la BD.
  const erroresFilas = validarFilasCompletas(filasCrudas)
  if (erroresFilas.length > 0) {
    throw new ValidationError('Etapa 2 — Hay filas incompletas o con datos inválidos', { diferencias: erroresFilas })
  }

  // Etapa 3 — Maestros: cada valor resuelve a un registro real, la
  // agrupación en pallets es consistente y (si hay OC) todo cuadra contra
  // sus líneas.
  const { filas, errores: erroresMaestros } = await resolverContraMaestros(filasCrudas)
  if (erroresMaestros.length > 0) {
    throw new ValidationError('Etapa 3 — Hay datos que no existen en los maestros', { diferencias: erroresMaestros })
  }

  const { pallets, errores: erroresAgrupacion } = agruparEnPallets(filas)
  if (erroresAgrupacion.length > 0) {
    throw new ValidationError('Etapa 3 — Inconsistencias al agrupar los pallets', { diferencias: erroresAgrupacion })
  }

  const origen: 'COMPRA' | 'CONSIGNACION' = recepcion.ordenCompraId ? 'COMPRA' : 'CONSIGNACION'

  if (recepcion.ordenCompraId) {
    const diferencias = await compararContraOc(recepcion.ordenCompraId, filas)
    if (diferencias.length > 0) {
      throw new ValidationError('Etapa 3 — No coincide la OC con la carga', { diferencias })
    }
  }

  // Etapa 4 — Inserción: todo cuadró, se cargan los pallets. `filas` viaja
  // también para que repo.crearPalletsYValidar pueda re-hacer la
  // comparación contra OC bajo lock, contra una lectura fresca (QA-RCV-007)
  // — el chequeo optimista de arriba no es la autoridad final.
  // `recepcion.templateCargaId` viaja también — IMPQ-RCV-001 (ronda 2): las
  // Etapas 1-3 (incluido el mapeo de columnas de esta misma llamada) corren
  // FUERA del lock, con el template leído al inicio de subirAdjunto(). Si un
  // PATCH concurrente cambia el template de la Recepción antes de que esta
  // carga tome el lock, el Excel ya se mapeó con el template viejo — crear
  // pallets igual dejaría la Recepción persistida con OTRO template al que
  // realmente se usó para leer el archivo, sin trazabilidad. Se aborta y se
  // pide reintentar en vez de eso.
  const recepcionActualizada = await repo.crearPalletsYValidar(
    recepcion.id,
    origen,
    recepcion.ordenCompraId,
    recepcion.templateCargaId,
    filas,
    pallets,
  )
  return {
    recepcion: recepcionActualizada,
    resumen: { pallets: pallets.length, cajas: filas.reduce((a, f) => a + f.cajas, 0) },
  }
}
