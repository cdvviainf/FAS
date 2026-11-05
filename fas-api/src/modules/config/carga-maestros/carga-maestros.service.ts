/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma } from '@prisma/client'
import type { ColumnaSpec, ErrorFila, HojaSpec } from '../../../lib/carga-maestros/tipos.js'
import { parsearLibro, validarReferenciasInternas } from '../../../lib/carga-maestros/parsear.js'
import { empresaContext } from '../../../lib/empresa-context.js'
import { prisma } from '../../../lib/prisma.js'
import { REGISTRO_MAESTROS, ordenTopologico } from './registro.js'

// Modelos con soft-delete (eliminadoEn): la verificación de existencia por clave
// natural debe ignorar las filas ya eliminadas. Nombres en estilo delegate
// (camelCase), igual que `hoja.modelo`.
const MODELOS_SOFT_DELETE = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === 'eliminadoEn'))
    .map((m) => m.name.charAt(0).toLowerCase() + m.name.slice(1)),
)

// IDEMPOTENCIA (2026-11-03): ¿ya existe una fila de esta empresa con la misma
// clave natural? El empresaId lo inyecta la extensión de tenancy (findFirst corre
// dentro del empresaContext.run del commit). Si la clave viene incompleta en el
// input, no se puede matchear → se crea.
async function buscarExistentePorClaveNatural(
  modelo: string,
  claveNatural: string[],
  input: Record<string, any>,
): Promise<number | null> {
  const where: Record<string, unknown> = {}
  for (const campo of claveNatural) {
    const val = input[campo]
    if (val == null) return null
    where[campo] = val
  }
  if (MODELOS_SOFT_DELETE.has(modelo)) where.eliminadoEn = null
  const delegate = (prisma as any)[modelo]
  if (!delegate?.findFirst) return null
  const found = await delegate.findFirst({ where, select: { id: true } })
  return (found as { id: number } | null)?.id ?? null
}

// Services y repos que el cargador reutiliza (misma lógica de negocio que la API).
import * as configService from '../config.service.js'
import * as configRepo from '../config.repository.js'
import { siguienteCodigo } from '../prefijos-codigo/prefijos-codigo.service.js'
import { crearPrefijoCodigo } from '../prefijos-codigo/prefijos-codigo.service.js'
import { crearEntidad, crearDireccion, crearContacto } from '../entidades/entidades.service.js'
import { direccionCreateSchema, contactoCreateSchema } from '../entidades/entidades.schema.js'
import { ZodError } from 'zod'
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
  resumen: Record<string, { filas: number; creados: number; existentes: number }>
  errores: ErrorFila[]
}

/** Resuelve un código a su id contra la BD (tenant-scoped por el contexto activo).
 *  `equivalencias` mapea modelo -> códigoExcel -> id de filas SALTADAS por clave
 *  natural (cuyo código persistido puede diferir del que trae el archivo): se
 *  consulta primero para que las FKs internas de filas hijas del mismo archivo
 *  apunten a la fila existente (FAS-CM-IDEMP-001). */
async function resolverCodigoAId(
  modelo: string,
  codigo: string,
  equivalencias?: Map<string, Map<string, number>>,
): Promise<number | null> {
  const eq = equivalencias?.get(modelo)?.get(codigo)
  if (eq != null) return eq
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
  equivalencias?: Map<string, Map<string, number>>,
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
      const id = await resolverCodigoAId(modelo, String(val), equivalencias)
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

  // Código propio: usar el del archivo, o DIFERIR la autogeneración. La
  // autogeneración (siguienteCodigo) se posterga a `asegurarCodigo`, que solo
  // corre si la fila realmente se va a crear — así una fila saltada por
  // idempotencia NO consume correlativo ni se bloquea por SIN_PREFIJO
  // (FAS-CM-IDEMP-002).
  if (colCodigo) {
    const codArchivo = fila.valores['codigo']
    if (codArchivo != null) {
      input.codigo = String(codArchivo)
    } else if (colCodigo.autogenerar && hoja.modelo) {
      input.__codigoPendiente = true
    } else if (colCodigo.requerido) {
      // Faltante obligatorio: ya reportado por el parser; solo bloquear.
      bloqueada = true
    }
  }

  return bloqueada ? null : input
}

// Autogenera el código vía PrefijoCodigo justo antes de crear (si quedó
// pendiente). Devuelve false si no hay prefijo configurado (fila bloqueada).
async function asegurarCodigo(
  hoja: HojaSpec,
  fila: { fila: number },
  input: Record<string, any>,
  errores: ErrorFila[],
): Promise<boolean> {
  if (!input.__codigoPendiente) return true
  delete input.__codigoPendiente
  const generado = hoja.modelo ? await siguienteCodigo(hoja.modelo) : null
  if (!generado) {
    errores.push({ hoja: hoja.hoja, fila: fila.fila, columna: 'Código', codigo: 'SIN_PREFIJO', mensaje: `No hay Prefijo de Código para "${hoja.modelo}": complete el código o configure el prefijo.` })
    return false
  }
  input.codigo = generado
  return true
}

// Valida un input de la carga con el schema Zod del contrato API (mismas
// restricciones que el POST). Convierte el ZodError en un mensaje legible que el
// orquestador ubica por hoja/fila (IMP-QA-R1-055).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validarConSchema<T>(schema: { parse: (d: unknown) => T }, data: any): T {
  try {
    return schema.parse(data)
  } catch (e) {
    if (e instanceof ZodError) {
      throw new Error(e.issues.map((i) => `${i.path.join('.') || 'campo'}: ${i.message}`).join('; '))
    }
    throw e
  }
}

/** Despacha la creación al service correcto según el modelo de la hoja.
 * `opts.permitirSinTaxId`: relaja el TaxID obligatorio del Cliente Extranjero en
 * la carga masiva (se completa luego); el alta manual lo sigue exigiendo. */
async function crearRegistro(
  hoja: HojaSpec,
  input: Record<string, any>,
  userId: string,
  opts?: { permitirSinTaxId?: boolean },
): Promise<void> {
  switch (hoja.modelo) {
    case 'entidad':
      await crearEntidad(input as any, userId, { permitirSinTaxId: opts?.permitirSinTaxId })
      break
    case 'entidadDireccion': {
      // La dirección se cuelga de una entidad existente. Si no se indicó país,
      // se usa el de la entidad (mismo criterio que el formulario).
      const { entidadId, paisId, ...body } = input
      let pid = paisId
      if (pid == null) {
        const ent = await entidadesRepo.findEntidadById(entidadId)
        pid = (ent as any)?.paisId
      }
      // Mismas restricciones de datos que el POST (rangos lat/long, largos) —
      // IMP-QA-R1-055: la carga no debe persistir lo que el alta normal rechaza.
      const data = validarConSchema(direccionCreateSchema, { ...body, paisId: pid })
      await crearDireccion(entidadId, data, userId)
      break
    }
    case 'entidadContacto': {
      const { entidadId, ...body } = input
      // Valida email/largos/etc. igual que el POST (IMP-QA-R1-055).
      const data = validarConSchema(contactoCreateSchema, body)
      await crearContacto(entidadId, data, userId)
      break
    }
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
      // Mapeo país↔mercado por empresa (N:M): agrega la arista de forma
      // idempotente, sin borrar otros mercados del país (no crea país ni mercado).
      await configRepo.agregarMercadoPais(input.paisId, input.mercadoId, userId)
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

export async function cargarMaestros(
  rutaOBuffer: string | Buffer,
  opciones: OpcionesCarga,
  registro: HojaSpec[] = REGISTRO_MAESTROS,
): Promise<ResultadoCarga> {
  const { empresaId, userId = SISTEMA_USER, dryRun = false } = opciones

  const parseo = await parsearLibro(rutaOBuffer, registro)
  const errores: ErrorFila[] = [
    ...parseo.errores,
    ...Object.values(parseo.hojas).flatMap((h) => h.errores),
    ...validarReferenciasInternas(parseo, registro),
  ]
  const resumen: Record<string, { filas: number; creados: number; existentes: number }> = {}
  // Las hojas de solo-referencia no producen registros: no entran al resumen.
  for (const h of registro) {
    if (h.soloReferencia) continue
    resumen[h.hoja] = { filas: parseo.hojas[h.hoja]?.filas.length ?? 0, creados: 0, existentes: 0 }
  }

  if (dryRun) {
    // Sin BD no se pueden validar unicidad ni FKs internas contra registros aún
    // no insertados; el dry-run se queda con la validación estructural + FKs
    // internas del archivo (ya incluidas arriba). El commit hace el resto.
    return { dryRun, resumen, errores }
  }

  await empresaContext.run({ empresaId }, async () => {
    const detallePorReceta = await ensamblarDetalleRecetas(parseo.hojas['RecetasDetalle']?.filas ?? [], errores)
    // modelo -> códigoExcel -> id de filas saltadas por idempotencia (ver
    // resolverCodigoAId): permite que las FKs internas resuelvan a la fila existente.
    const equivalencias = new Map<string, Map<string, number>>()

    for (const hoja of ordenTopologico(registro)) {
      if (hoja.soloReferencia) continue // hojas de referencia: no se cargan
      if (hoja.hoja === 'RecetasDetalle') continue // se carga junto con Recetas

      for (const fila of parseo.hojas[hoja.hoja]?.filas ?? []) {
        const input = await construirInput(hoja, fila, errores, equivalencias)
        if (!input) continue

        if (hoja.modelo === 'receta') {
          input.detalle = detallePorReceta.get(String(fila.valores['codigo'] ?? '')) ?? []
        }

        // IDEMPOTENCIA: si ya existe una fila con la misma clave natural en esta
        // empresa, se SALTA (no se re-crea) — así re-cargar el mismo archivo no
        // duplica (los códigos autogenerados no sirven para reconocerla). Se chequea
        // ANTES de autogenerar el código, para no consumir correlativo en vano.
        if (hoja.claveNatural && hoja.modelo) {
          const existenteId = await buscarExistentePorClaveNatural(hoja.modelo, hoja.claveNatural, input)
          if (existenteId != null) {
            resumen[hoja.hoja].existentes++
            // El código del Excel (si lo trae) de esta fila saltada -> id existente,
            // para que las FKs internas de filas hijas resuelvan a esta fila aunque
            // su código persistido difiera (FAS-CM-IDEMP-001).
            if (typeof input.codigo === 'string' && input.codigo) {
              if (!equivalencias.has(hoja.modelo)) equivalencias.set(hoja.modelo, new Map())
              equivalencias.get(hoja.modelo)!.set(input.codigo, existenteId)
            }
            continue
          }
        }

        // IMP-QA-R2-053: un País NUEVO (no matcheado por descripción arriba) debe
        // traer su código ISO 3166-1 alfa-3; no se persiste el nombre como código.
        // Los países ya existentes se resolvieron por descripción (idempotencia) y
        // no llegan acá; esto solo frena crear un país no-ISO desde el Excel.
        if (hoja.modelo === 'pais' && typeof input.codigo === 'string' && !/^[A-Za-z]{3}$/.test(input.codigo.trim())) {
          errores.push({
            hoja: hoja.hoja,
            fila: fila.fila,
            columna: 'Código',
            codigo: 'PAIS_CODIGO_NO_ISO',
            mensaje: `País nuevo "${input.descripcion ?? input.codigo}": el código "${input.codigo}" no es ISO alfa-3 (3 letras). Usa el código ISO, o verifica que el país ya exista (se reconoce por su descripción).`,
          })
          continue
        }

        // Recién ahora (se va a crear) se autogenera el código si quedó pendiente.
        if (!(await asegurarCodigo(hoja, fila, input, errores))) continue

        try {
          // permitirSinTaxId: en carga masiva, CLIENTE_EXTRANJERO puede crearse sin
          // TaxID (se completa luego); el alta manual lo sigue exigiendo.
          await crearRegistro(hoja, input, userId, { permitirSinTaxId: true })
          resumen[hoja.hoja].creados++
        } catch (err: any) {
          errores.push({ hoja: hoja.hoja, fila: fila.fila, codigo: 'ERROR_CREACION', mensaje: err?.message ?? String(err) })
        }
      }
    }
  })

  return { dryRun, resumen, errores }
}
