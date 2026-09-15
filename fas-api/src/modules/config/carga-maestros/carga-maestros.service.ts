/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ColumnaSpec, ErrorFila, HojaSpec } from '../../../lib/carga-maestros/tipos.js'
import { parsearLibro, validarReferenciasInternas } from '../../../lib/carga-maestros/parsear.js'
import { empresaContext } from '../../../lib/empresa-context.js'
import { REGISTRO_MAESTROS, ordenTopologico } from './registro.js'

// Services y repos que el cargador reutiliza (misma lógica de negocio que la API).
import * as configService from '../config.service.js'
import * as configRepo from '../config.repository.js'
import { siguienteCodigo } from '../prefijos-codigo/prefijos-codigo.service.js'
import { crearPrefijoCodigo } from '../prefijos-codigo/prefijos-codigo.service.js'
import { crearEntidad } from '../entidades/entidades.service.js'
import * as entidadesRepo from '../entidades/entidades.repository.js'
import { crearArticulo } from '../../materiales/articulos/articulos.service.js'
import * as articulosRepo from '../../materiales/articulos/articulos.repository.js'
import { crearReceta } from '../../materiales/recetas/recetas.service.js'
import * as recetasRepo from '../../materiales/recetas/recetas.repository.js'
import { crearPredio } from '../../productores/predios/predios.service.js'
import { upsertPorPar as upsertCajasPorPallet } from '../cajas-por-pallet/cajas-por-pallet.service.js'

const SISTEMA_USER = 'sistema'
const MODELO_POR_HOJA = new Map(REGISTRO_MAESTROS.map((h) => [h.hoja, h.modelo]))

export interface OpcionesCarga {
  empresaId: number
  userId?: string
  /** true = solo validar (no escribe en BD). */
  dryRun?: boolean
}

export interface ResultadoCarga {
  dryRun: boolean
  resumen: Record<string, { filas: number; creados: number }>
  errores: ErrorFila[]
}

/** Resuelve un código a su id contra la BD (tenant-scoped por el contexto activo). */
async function resolverCodigoAId(modelo: string, codigo: string): Promise<number | null> {
  switch (modelo) {
    case 'entidad': {
      const e = await entidadesRepo.findEntidadByCodigo(codigo)
      return (e as any)?.id ?? null
    }
    case 'articulo': {
      const a = await articulosRepo.findArticuloByCodigo(codigo)
      return (a as any)?.id ?? null
    }
    case 'receta': {
      const r = await recetasRepo.findRecetaByCodigo(codigo)
      return (r as any)?.id ?? null
    }
    default: {
      const m = await configRepo.findMantenedorByCodigo(modelo as any, codigo)
      return (m as any)?.id ?? null
    }
  }
}

/** Modelo destino de una columna FK (explícito en externas, derivado en internas). */
function modeloDestinoFk(col: ColumnaSpec): string | undefined {
  return col.fk?.modelo ?? (col.fk?.hoja ? MODELO_POR_HOJA.get(col.fk.hoja) : undefined)
}

/**
 * Construye el input para el service de una fila: resuelve FKs a ids, convierte
 * decimales y autogenera el código si corresponde. Devuelve null si la fila
 * tiene un error que impide crearla (ya registrado en `errores`).
 */
async function construirInput(
  hoja: HojaSpec,
  fila: { fila: number; valores: Record<string, unknown> },
  errores: ErrorFila[],
): Promise<Record<string, any> | null> {
  const input: Record<string, any> = {}
  let bloqueada = false
  let colCodigo: ColumnaSpec | undefined

  for (const col of hoja.columnas) {
    if (!col.campo) continue
    if (col.campo === 'codigo') {
      colCodigo = col
      continue // se procesa al final (posible autogeneración)
    }
    const val = fila.valores[col.campo]

    if (col.tipo === 'fk') {
      if (val == null) {
        // El faltante obligatorio ya lo reportó el parser estructural; aquí solo
        // se bloquea la fila para no crearla (evita doble conteo en el reporte).
        if (col.requerido) bloqueada = true
        continue
      }
      const modelo = modeloDestinoFk(col)
      if (!modelo) continue
      const id = await resolverCodigoAId(modelo, String(val))
      if (id == null) {
        errores.push({ hoja: hoja.hoja, fila: fila.fila, columna: col.encabezado, codigo: 'FK_NO_RESUELTA', mensaje: `No existe "${val}" en ${modelo}.` })
        bloqueada = true
        continue
      }
      input[col.campo] = id
      continue
    }

    if (val == null) {
      // Faltante obligatorio: ya reportado por el parser; solo bloquear.
      if (col.requerido) bloqueada = true
      continue
    }
    input[col.campo] = col.tipo === 'decimal' ? Number(val) : val
  }

  // Código propio: usar el del archivo o autogenerar vía PrefijoCodigo.
  if (colCodigo) {
    const codArchivo = fila.valores['codigo']
    if (codArchivo != null) {
      input.codigo = String(codArchivo)
    } else if (colCodigo.autogenerar && hoja.modelo) {
      const generado = await siguienteCodigo(hoja.modelo)
      if (!generado) {
        errores.push({ hoja: hoja.hoja, fila: fila.fila, columna: 'Código', codigo: 'SIN_PREFIJO', mensaje: `No hay Prefijo de Código para "${hoja.modelo}": complete el código o configure el prefijo.` })
        bloqueada = true
      } else {
        input.codigo = generado
      }
    } else if (colCodigo.requerido) {
      // Faltante obligatorio: ya reportado por el parser; solo bloquear.
      bloqueada = true
    }
  }

  return bloqueada ? null : input
}

/** Despacha la creación al service correcto según el modelo de la hoja. */
async function crearRegistro(hoja: HojaSpec, input: Record<string, any>, userId: string): Promise<void> {
  switch (hoja.modelo) {
    case 'entidad':
      await crearEntidad(input as any, userId)
      break
    case 'articulo':
      await crearArticulo(input as any)
      break
    case 'predio': {
      const { entidadId, ...body } = input
      await crearPredio(entidadId, body as any, userId)
      break
    }
    case 'receta':
      await crearReceta(input as any)
      break
    case 'prefijoCodigo':
      await crearPrefijoCodigo(input as any, userId)
      break
    case 'mercadoPais':
      // Mapeo país↔mercado por empresa: upsert (no crea país ni mercado).
      await configRepo.upsertMercadoPais(input.paisId, input.mercadoId, userId)
      break
    case 'cajasPorPallet':
      // Cajas teóricas por embalaje+tipo pallet: upsert validado.
      await upsertCajasPorPallet(input.articuloId, input.tipoPalletId, input.cajasPorPallet, userId)
      break
    default:
      await configService.crearMantenedor(hoja.modelo as any, input as any, userId)
  }
}

/** Ensambla el detalle de cada receta desde la hoja RecetasDetalle. */
async function ensamblarDetalleRecetas(
  parseoRecetasDetalle: { fila: number; valores: Record<string, unknown> }[],
  errores: ErrorFila[],
): Promise<Map<string, any[]>> {
  const porReceta = new Map<string, any[]>()
  for (const d of parseoRecetasDetalle) {
    const recetaCod = d.valores['recetaId'] as string | undefined
    const compCod = d.valores['componenteId'] as string | undefined
    if (!recetaCod || !compCod) continue
    const componenteId = await resolverCodigoAId('articulo', compCod)
    if (componenteId == null) {
      errores.push({ hoja: 'RecetasDetalle', fila: d.fila, columna: 'Componente (código de Artículo)', codigo: 'FK_NO_RESUELTA', mensaje: `No existe el artículo "${compCod}".` })
      continue
    }
    const lista = porReceta.get(recetaCod) ?? []
    lista.push({ componenteId, cantidadAConsumir: Number(d.valores['cantidadAConsumir']) })
    porReceta.set(recetaCod, lista)
  }
  return porReceta
}

export async function cargarMaestros(rutaOBuffer: string | Buffer, opciones: OpcionesCarga): Promise<ResultadoCarga> {
  const { empresaId, userId = SISTEMA_USER, dryRun = false } = opciones

  const parseo = await parsearLibro(rutaOBuffer, REGISTRO_MAESTROS)
  const errores: ErrorFila[] = [
    ...parseo.errores,
    ...Object.values(parseo.hojas).flatMap((h) => h.errores),
    ...validarReferenciasInternas(parseo, REGISTRO_MAESTROS),
  ]
  const resumen: Record<string, { filas: number; creados: number }> = {}
  for (const h of REGISTRO_MAESTROS) resumen[h.hoja] = { filas: parseo.hojas[h.hoja]?.filas.length ?? 0, creados: 0 }

  if (dryRun) {
    // Sin BD no se pueden validar unicidad ni FKs internas contra registros aún
    // no insertados; el dry-run se queda con la validación estructural + FKs
    // internas del archivo (ya incluidas arriba). El commit hace el resto.
    return { dryRun, resumen, errores }
  }

  await empresaContext.run({ empresaId }, async () => {
    const detallePorReceta = await ensamblarDetalleRecetas(parseo.hojas['RecetasDetalle']?.filas ?? [], errores)

    for (const hoja of ordenTopologico()) {
      if (hoja.hoja === 'RecetasDetalle') continue // se carga junto con Recetas

      for (const fila of parseo.hojas[hoja.hoja]?.filas ?? []) {
        const input = await construirInput(hoja, fila, errores)
        if (!input) continue

        if (hoja.modelo === 'receta') {
          input.detalle = detallePorReceta.get(String(fila.valores['codigo'] ?? '')) ?? []
        }

        try {
          await crearRegistro(hoja, input, userId)
          resumen[hoja.hoja].creados++
        } catch (err: any) {
          errores.push({ hoja: hoja.hoja, fila: fila.fila, codigo: 'ERROR_CREACION', mensaje: err?.message ?? String(err) })
        }
      }
    }
  })

  return { dryRun, resumen, errores }
}
