import { parsearLibro, validarReferenciasInternas } from '../../../lib/carga-maestros/parsear.js'
import type { ErrorFila } from '../../../lib/carga-maestros/tipos.js'
import { empresaContext } from '../../../lib/empresa-context.js'
import { REGISTRO_RECETAS } from '../../config/carga-maestros/registro.js'
import * as articulosRepo from '../articulos/articulos.repository.js'
import * as recetasRepo from '../recetas/recetas.repository.js'
import { crearReceta } from '../recetas/recetas.service.js'
import { recetaCreateSchema } from '../recetas/recetas.schema.js'

// Carga dedicada de recetas — formato de UNA sola hoja (una fila por
// componente). Las columnas de cabecera (Embalaje, Descripción, Cantidad a
// Producir) se repiten en cada fila de la misma receta; se agrupa por "Receta
// (código)". Valida TODO (existencia tenant-scoped del embalaje/componentes,
// R13, consistencia de cabecera, mínimo un componente, cantidades positivas)
// tanto en dry-run como en commit. El commit reutiliza `crearReceta`.

const COMPONENTES_VALIDOS = new Set(['MATERIAL_EMBALAJE', 'SERVICIO'])
const COL_RECETA = 'Receta (código)'
const COL_EMBALAJE = 'Embalaje (código de Artículo tipo EMBALAJE)'
const COL_DESCRIPCION = 'Descripción'
const COL_CANT_PRODUCIR = 'Cantidad a Producir'
const COL_COMPONENTE = 'Componente (código de Artículo)'
const COL_CANT_CONSUMIR = 'Cantidad a Consumir'

export interface OpcionesCargaRecetas {
  empresaId: number
  userId?: string
  /** true = solo validar (no escribe en BD). */
  dryRun?: boolean
}

export interface ResultadoCargaRecetas {
  dryRun: boolean
  resumen: Record<string, { filas: number; creados: number }>
  errores: ErrorFila[]
}

const texto = (v: unknown): string => (v == null ? '' : String(v).trim())

// Arma los datos a precargar en el template (hoja de referencia Embalajes y, si
// `conEjemplo`, filas de ejemplo en la hoja Recetas). Se corre en el contexto de
// empresa para que las consultas queden tenant-scoped. El ejemplo usa códigos
// REALES de la empresa (primer embalaje + hasta 2 componentes); si no hay
// artículos aún, cae a placeholders que el usuario debe reemplazar.
export async function construirDatosPlantillaRecetas(
  empresaId: number,
  conEjemplo: boolean,
): Promise<Record<string, Array<Record<string, unknown>>>> {
  return empresaContext.run({ empresaId }, async () => {
    const embalajes = await articulosRepo.findArticulosParaReferencia(['EMBALAJE'])
    const datosPorHoja: Record<string, Array<Record<string, unknown>>> = {
      Embalajes: embalajes.map((e) => ({ codigo: e.codigo, descripcion: e.descripcion })),
    }

    if (conEjemplo) {
      const componentes = await articulosRepo.findArticulosParaReferencia(['MATERIAL_EMBALAJE', 'SERVICIO'])
      const embalajeCod = embalajes[0]?.codigo ?? 'COD-EMBALAJE'
      // Hasta 2 componentes distintos (para ilustrar la cabecera repetida en
      // varias filas); placeholders solo si la empresa no tiene componentes.
      const compCods = componentes.slice(0, 2).map((c) => c.codigo)
      if (compCods.length === 0) compCods.push('COD-COMPONENTE-1', 'COD-COMPONENTE-2')
      datosPorHoja.Recetas = compCods.map((componenteCod, i) => ({
        recetaCod: 'RECETA-EJEMPLO',
        embalajeCod,
        descripcion: 'Receta de ejemplo (reemplazar)',
        cantidadAProducir: 1000,
        componenteCod,
        cantidadAConsumir: i + 1,
      }))
    }

    return datosPorHoja
  })
}

export async function cargarRecetas(
  rutaOBuffer: string | Buffer,
  opciones: OpcionesCargaRecetas,
): Promise<ResultadoCargaRecetas> {
  const { empresaId, dryRun = false } = opciones

  const parseo = await parsearLibro(rutaOBuffer, REGISTRO_RECETAS)
  const errores: ErrorFila[] = [
    ...parseo.errores,
    ...Object.values(parseo.hojas).flatMap((h) => h.errores),
    ...validarReferenciasInternas(parseo, REGISTRO_RECETAS),
  ]

  const filas = parseo.hojas['Recetas']?.filas ?? []

  // Agrupa por código de receta, preservando el orden de aparición. Las filas
  // sin código ya fueron marcadas como requerido por el parser.
  const grupos = new Map<string, Array<{ fila: number; valores: Record<string, unknown> }>>()
  for (const f of filas) {
    const cod = texto(f.valores['recetaCod'])
    if (!cod) continue
    const lista = grupos.get(cod) ?? []
    lista.push({ fila: f.fila, valores: f.valores })
    grupos.set(cod, lista)
  }

  const resumen = {
    Recetas: { filas: grupos.size, creados: 0 },
    Componentes: { filas: filas.length, creados: 0 },
  }

  await empresaContext.run({ empresaId }, async () => {
    const artCache = new Map<string, { id: number; tipo: string } | null>()
    const resolver = async (cod: string) => {
      if (artCache.has(cod)) return artCache.get(cod)!
      const a = (await articulosRepo.findArticuloByCodigo(cod)) as { id: number; tipo: string } | null
      const v = a ? { id: a.id, tipo: a.tipo } : null
      artCache.set(cod, v)
      return v
    }

    for (const [codReceta, rows] of grupos) {
      const repFila = rows[0].fila // fila representativa para errores de cabecera
      const grupoFilas = new Set(rows.map((r) => r.fila))
      let bloqueada = false
      const errFila = (fila: number, columna: string | undefined, codigo: string, mensaje: string) => {
        errores.push({ hoja: 'Recetas', fila, columna, codigo, mensaje })
        bloqueada = true
      }

      // Consistencia de cabecera: el valor de la receta es el primero no vacío;
      // cualquier fila con un valor distinto es un conflicto.
      const valorCabecera = (campo: string, columna: string): string => {
        let elegido = ''
        for (const r of rows) {
          const v = texto(r.valores[campo])
          if (v === '') continue
          if (elegido === '') elegido = v
          else if (v !== elegido) errFila(r.fila, columna, 'CABECERA_INCONSISTENTE', `El valor de "${columna}" difiere dentro de la receta "${codReceta}".`)
        }
        return elegido
      }
      // Las 3 columnas de cabecera son requeridas por fila (el parser marca los
      // faltantes); aquí solo se toma el valor y se valida la consistencia.
      const embalajeCod = valorCabecera('embalajeCod', COL_EMBALAJE)
      const descripcion = valorCabecera('descripcion', COL_DESCRIPCION)
      const cantProducirStr = valorCabecera('cantidadAProducir', COL_CANT_PRODUCIR)

      // Embalaje: existe y es tipo EMBALAJE (R13).
      let embalajeId: number | null = null
      if (embalajeCod) {
        const emb = await resolver(embalajeCod)
        if (!emb) errFila(repFila, COL_EMBALAJE, 'FK_NO_RESUELTA', `No existe el artículo "${embalajeCod}".`)
        else if (emb.tipo !== 'EMBALAJE') errFila(repFila, COL_EMBALAJE, 'TIPO_INVALIDO', `El artículo "${embalajeCod}" no es tipo EMBALAJE (R13).`)
        else embalajeId = emb.id
      }

      // Código ya existente en BD (la carga crea, no actualiza).
      const existente = await recetasRepo.findRecetaByCodigo(codReceta)
      if (existente) errFila(repFila, COL_RECETA, 'CODIGO_EXISTENTE', `Ya existe una receta con código "${codReceta}".`)

      // Componentes: una fila cada uno. Existen y son MATERIAL_EMBALAJE/SERVICIO,
      // sin repetir el mismo componente dentro de la receta, cantidad > 0.
      const detalleInput: { componenteId: number; cantidadAConsumir: number }[] = []
      const componentesVistos = new Set<string>()
      for (const r of rows) {
        const compCod = texto(r.valores['componenteCod'])
        if (!compCod) continue // requerido ya marcado por el parser
        if (componentesVistos.has(compCod)) {
          errFila(r.fila, COL_COMPONENTE, 'COMPONENTE_DUPLICADO', `El componente "${compCod}" está repetido en la receta "${codReceta}".`)
          continue
        }
        componentesVistos.add(compCod)
        const comp = await resolver(compCod)
        if (!comp) {
          errFila(r.fila, COL_COMPONENTE, 'FK_NO_RESUELTA', `No existe el artículo "${compCod}".`)
        } else if (!COMPONENTES_VALIDOS.has(comp.tipo)) {
          errFila(r.fila, COL_COMPONENTE, 'TIPO_INVALIDO', `El artículo "${compCod}" no es Material de Embalaje ni Servicio (R13).`)
        } else {
          const cant = Number(r.valores['cantidadAConsumir'])
          if (!(cant > 0)) errFila(r.fila, COL_CANT_CONSUMIR, 'VALOR_INVALIDO', 'La cantidad a consumir debe ser mayor a 0.')
          else detalleInput.push({ componenteId: comp.id, cantidadAConsumir: cant })
        }
      }

      // Contrato completo de POST /recetas vía su schema (descripción, cantidad
      // a producir > 0, longitudes). Se deduplican las celdas ya reportadas.
      const candidato = {
        embalajeId: embalajeId ?? 0,
        codigo: codReceta,
        descripcion,
        cantidadAProducir: Number(cantProducirStr),
        activo: true,
        detalle: detalleInput,
      }
      const parsed = recetaCreateSchema.safeParse(candidato)
      if (!parsed.success) {
        const columnaPorCampo: Record<string, string> = { descripcion: COL_DESCRIPCION, cantidadAProducir: COL_CANT_PRODUCIR, codigo: COL_RECETA }
        const celdasReportadas = new Set(errores.filter((e) => e.hoja === 'Recetas' && e.fila === repFila).map((e) => e.columna))
        for (const issue of parsed.error.issues) {
          const columna = columnaPorCampo[String(issue.path[0] ?? '')]
          if (!columna) continue // embalajeId / detalle se manejan aparte
          bloqueada = true
          if (celdasReportadas.has(columna)) continue
          errores.push({ hoja: 'Recetas', fila: repFila, columna, codigo: 'VALOR_INVALIDO', mensaje: issue.message })
        }
      }

      // Red de seguridad (CRF-001): nunca persistir una receta si CUALQUIERA de
      // sus filas tiene algún error (estructural del parser incluido). Garantiza
      // la unidad de éxito/error POR RECETA.
      if (!bloqueada && errores.some((e) => e.hoja === 'Recetas' && grupoFilas.has(e.fila))) {
        bloqueada = true
      }

      // Commit: solo recetas sin ningún error, con embalaje resuelto y ≥1 componente.
      if (!dryRun && !bloqueada && embalajeId != null && detalleInput.length > 0) {
        try {
          await crearReceta({ embalajeId, codigo: codReceta, descripcion, cantidadAProducir: Number(cantProducirStr), detalle: detalleInput })
          resumen.Recetas.creados++
          resumen.Componentes.creados += detalleInput.length
        } catch (error) {
          errores.push({ hoja: 'Recetas', fila: repFila, codigo: 'ERROR_CREACION', mensaje: error instanceof Error ? error.message : String(error) })
        }
      }
    }
  })

  return { dryRun, resumen, errores }
}
