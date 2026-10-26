import { parsearLibro, validarReferenciasInternas } from '../../../lib/carga-maestros/parsear.js'
import type { ErrorFila } from '../../../lib/carga-maestros/tipos.js'
import { empresaContext } from '../../../lib/empresa-context.js'
import { REGISTRO_RECETAS } from '../../config/carga-maestros/registro.js'
import * as articulosRepo from '../articulos/articulos.repository.js'
import * as recetasRepo from '../recetas/recetas.repository.js'
import { crearReceta } from '../recetas/recetas.service.js'
import { recetaCreateSchema } from '../recetas/recetas.schema.js'

// Carga dedicada de recetas. A diferencia del motor genérico de Carga Masiva,
// valida TODO (existencia tenant-scoped del embalaje/componentes, reglas R13 y
// mínimo de un componente) tanto en dry-run como en commit — así "Validar" es
// fiable sin escribir en la base. El commit reutiliza `crearReceta` (que vuelve
// a validar). Las cantidades se persisten como number (el schema del service
// las convierte a Decimal).

const COMPONENTES_VALIDOS = new Set(['MATERIAL_EMBALAJE', 'SERVICIO'])
const COL_EMBALAJE = 'Embalaje (código de Artículo tipo EMBALAJE)'
const COL_COMPONENTE = 'Componente (código de Artículo)'

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

export async function cargarRecetas(
  rutaOBuffer: string | Buffer,
  opciones: OpcionesCargaRecetas,
): Promise<ResultadoCargaRecetas> {
  const { empresaId, dryRun = false } = opciones

  const parseo = await parsearLibro(rutaOBuffer, REGISTRO_RECETAS)
  const errores: ErrorFila[] = [
    ...parseo.errores,
    ...Object.values(parseo.hojas).flatMap((h) => h.errores),
    // FKs internas: valida que cada detalle referencie un código de receta
    // declarado en la hoja Recetas, y detecta códigos de receta duplicados.
    ...validarReferenciasInternas(parseo, REGISTRO_RECETAS),
  ]

  const filasRecetas = parseo.hojas['Recetas']?.filas ?? []
  const filasDetalle = parseo.hojas['RecetasDetalle']?.filas ?? []
  const resumen = {
    Recetas: { filas: filasRecetas.length, creados: 0 },
    RecetasDetalle: { filas: filasDetalle.length, creados: 0 },
  }

  await empresaContext.run({ empresaId }, async () => {
    // Detalle agrupado por código de receta (tal cual viene en la celda).
    const detallePorReceta = new Map<string, Array<{ fila: number; componenteCod: string; cantidad: number }>>()
    for (const f of filasDetalle) {
      const rc = String(f.valores['recetaId'] ?? '')
      if (!rc) continue
      const lista = detallePorReceta.get(rc) ?? []
      lista.push({ fila: f.fila, componenteCod: String(f.valores['componenteId'] ?? ''), cantidad: Number(f.valores['cantidadAConsumir']) })
      detallePorReceta.set(rc, lista)
    }

    // Códigos de receta repetidos dentro de la hoja: el detalle se agrupa solo
    // por código, así que una cabecera duplicada vuelve ambigua la asociación.
    // Se bloquean TODAS las filas con un código repetido — no solo la 2ª que
    // marca el parser — para no persistir ninguna (CR-QA-008).
    const conteoCodigos = new Map<string, number>()
    for (const fr of filasRecetas) {
      const c = String(fr.valores['codigo'] ?? '')
      if (c) conteoCodigos.set(c, (conteoCodigos.get(c) ?? 0) + 1)
    }
    const codigosDuplicados = new Set([...conteoCodigos].filter(([, n]) => n > 1).map(([c]) => c))

    // Resolución de artículos cacheada (código -> {id, tipo} | null).
    const artCache = new Map<string, { id: number; tipo: string } | null>()
    const resolver = async (cod: string) => {
      if (artCache.has(cod)) return artCache.get(cod)!
      const a = (await articulosRepo.findArticuloByCodigo(cod)) as { id: number; tipo: string } | null
      const v = a ? { id: a.id, tipo: a.tipo } : null
      artCache.set(cod, v)
      return v
    }

    for (const fr of filasRecetas) {
      const codReceta = String(fr.valores['codigo'] ?? '')
      const embalajeCod = String(fr.valores['embalajeId'] ?? '')
      let bloqueada = false
      const err = (columna: string | undefined, codigo: string, mensaje: string) => {
        errores.push({ hoja: 'Recetas', fila: fr.fila, columna, codigo, mensaje })
        bloqueada = true
      }

      // Código repetido en la hoja: bloquea esta cabecera (el parser solo marca
      // la 2ª aparición; aquí se flagan todas para no crear ninguna).
      if (codReceta && codigosDuplicados.has(codReceta)) {
        const yaMarcada = errores.some((e) => e.hoja === 'Recetas' && e.fila === fr.fila && e.codigo === 'CODIGO_DUPLICADO')
        if (yaMarcada) bloqueada = true
        else err('Código', 'CODIGO_DUPLICADO', `El código de receta "${codReceta}" está repetido en la hoja.`)
      }

      // Embalaje (cabecera): debe existir y ser tipo EMBALAJE (R13).
      let embalajeId: number | null = null
      if (embalajeCod) {
        const emb = await resolver(embalajeCod)
        if (!emb) err(COL_EMBALAJE, 'FK_NO_RESUELTA', `No existe el artículo "${embalajeCod}".`)
        else if (emb.tipo !== 'EMBALAJE') err(COL_EMBALAJE, 'TIPO_INVALIDO', `El artículo "${embalajeCod}" no es tipo EMBALAJE (R13).`)
        else embalajeId = emb.id
      }

      // Código ya existente en BD (la carga crea, no actualiza).
      if (codReceta) {
        const existente = await recetasRepo.findRecetaByCodigo(codReceta)
        if (existente) err('Código', 'CODIGO_EXISTENTE', `Ya existe una receta con código "${codReceta}".`)
      }

      // Componentes: existen y son MATERIAL_EMBALAJE o SERVICIO (R13). Mínimo 1.
      const dets = detallePorReceta.get(codReceta) ?? []
      const detFilas = new Set(dets.map((d) => d.fila))
      if (dets.length === 0) {
        err(undefined, 'SIN_DETALLE', `La receta "${codReceta || '(sin código)'}" no tiene componentes (mínimo 1).`)
      }
      const detalleInput: { componenteId: number; cantidadAConsumir: number }[] = []
      // Un componente no puede repetirse en la misma receta: el contrato de
      // `crearReceta` lo rechaza en el commit (compara cantidades de ids), así
      // que lo bloqueamos también en dry-run para que ambos sean consistentes
      // (CR-QA-007). Si en el futuro se decide consolidar, se cambia aquí.
      const componentesVistos = new Set<string>()
      for (const d of dets) {
        if (!d.componenteCod) continue
        if (componentesVistos.has(d.componenteCod)) {
          errores.push({ hoja: 'RecetasDetalle', fila: d.fila, columna: COL_COMPONENTE, codigo: 'COMPONENTE_DUPLICADO', mensaje: `El componente "${d.componenteCod}" está repetido en la receta "${codReceta}".` })
          bloqueada = true
          continue
        }
        componentesVistos.add(d.componenteCod)
        const comp = await resolver(d.componenteCod)
        if (!comp) {
          errores.push({ hoja: 'RecetasDetalle', fila: d.fila, columna: COL_COMPONENTE, codigo: 'FK_NO_RESUELTA', mensaje: `No existe el artículo "${d.componenteCod}".` })
          bloqueada = true
        } else if (!COMPONENTES_VALIDOS.has(comp.tipo)) {
          errores.push({ hoja: 'RecetasDetalle', fila: d.fila, columna: COL_COMPONENTE, codigo: 'TIPO_INVALIDO', mensaje: `El artículo "${d.componenteCod}" no es Material de Embalaje ni Servicio (R13).` })
          bloqueada = true
        } else if (!(d.cantidad > 0)) {
          errores.push({ hoja: 'RecetasDetalle', fila: d.fila, columna: 'Cantidad a Consumir', codigo: 'VALOR_INVALIDO', mensaje: 'La cantidad a consumir debe ser mayor a 0.' })
          bloqueada = true
        } else {
          detalleInput.push({ componenteId: comp.id, cantidadAConsumir: d.cantidad })
        }
      }

      // Contrato completo de POST /recetas vía su mismo schema (CR-QA-005):
      // descripción no vacía, cantidad a producir > 0, longitudes. Se deduplican
      // las celdas ya reportadas por el parser estructural o las validaciones
      // anteriores. embalajeId/detalle se validan arriba y se omiten aquí.
      const candidato = {
        embalajeId: embalajeId ?? 0,
        codigo: codReceta,
        descripcion: String(fr.valores['descripcion'] ?? ''),
        cantidadAProducir: Number(fr.valores['cantidadAProducir']),
        activo: true,
        detalle: detalleInput,
      }
      const parsed = recetaCreateSchema.safeParse(candidato)
      if (!parsed.success) {
        const columnaPorCampo: Record<string, string> = { descripcion: 'Descripción', cantidadAProducir: 'Cantidad a Producir', codigo: 'Código' }
        const celdasReportadas = new Set(errores.filter((e) => e.hoja === 'Recetas' && e.fila === fr.fila).map((e) => e.columna))
        for (const issue of parsed.error.issues) {
          const columna = columnaPorCampo[String(issue.path[0] ?? '')]
          if (!columna) continue // embalajeId / detalle se manejan aparte
          bloqueada = true
          if (celdasReportadas.has(columna)) continue // ya reportado (no duplicar)
          errores.push({ hoja: 'Recetas', fila: fr.fila, columna, codigo: 'VALOR_INVALIDO', mensaje: issue.message })
        }
      }

      // Red de seguridad: nunca persistir una fila que tenga CUALQUIER error
      // (estructural del parser incluido) en su cabecera o su detalle.
      if (!bloqueada && errores.some((e) => (e.hoja === 'Recetas' && e.fila === fr.fila) || (e.hoja === 'RecetasDetalle' && detFilas.has(e.fila)))) {
        bloqueada = true
      }

      // Commit: solo filas sin errores. `crearReceta` revalida (defensa en profundidad).
      if (!dryRun && !bloqueada && embalajeId != null && detalleInput.length > 0) {
        try {
          await crearReceta({
            embalajeId,
            codigo: codReceta,
            descripcion: String(fr.valores['descripcion'] ?? ''),
            cantidadAProducir: Number(fr.valores['cantidadAProducir']),
            detalle: detalleInput,
          })
          resumen.Recetas.creados++
          resumen.RecetasDetalle.creados += detalleInput.length
        } catch (error) {
          errores.push({ hoja: 'Recetas', fila: fr.fila, codigo: 'ERROR_CREACION', mensaje: error instanceof Error ? error.message : String(error) })
        }
      }
    }
  })

  return { dryRun, resumen, errores }
}
