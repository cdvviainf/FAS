import { env } from '../../../config/env.js'
import { ValidationError } from '../../../shared/errors.js'
import * as repo from './dte-emitidos.repository.js'
import * as libredte from './libredte.adapter.js'
import type { LibredteDtePayload } from './libredte.types.js'

export interface EmitirDteTemporalInput {
  origenTipo: string
  origenId: number
  tipoDte: number
  payload: LibredteDtePayload
  rutEmisor: string
  rutReceptor: string
  creadoPor: string
}

// Orquesta la emisión del DTE temporal de un origen (hoy solo 'movimiento').
//
// Idempotente frente a reintentos Y a concurrencia (IMP-QA-R1-029, QA ronda 1):
// tomarDocumentoDteParaEmitir() decide atómicamente, bajo advisory lock, quién
// llama a LibreDTE (`debeEmitir`) — si ya hay un TEMPORAL_CREADO o ya hay otro
// intento EMITIENDO en curso para el mismo origen, este call NO vuelve a
// llamar a LibreDTE, solo devuelve la fila tal cual.
//
// DTE_PROVIDER (IMP-QA-R1-028, QA ronda 1): mismo criterio que AGL_PROVIDER en
// agl360.adapter.ts — si no es 'libredte' (default 'mock'), NUNCA se llama al
// adapter real; se registra un resultado simulado. Evita que dev/staging con
// la config default dispare llamadas reales a LibreDTE por accidente.
//
// Alcance actual (2026-09-21): solo llega hasta emitirTemporal(). generarReal()
// (folio, XML, timbrado real) es la Fase 2 — ver DocumentoDte en schema.prisma.
export async function emitirDteTemporal(input: EmitirDteTemporalInput) {
  const { doc, debeEmitir } = await repo.tomarDocumentoDteParaEmitir({
    origenTipo: input.origenTipo,
    origenId: input.origenId,
    tipoDte: input.tipoDte,
    rutEmisor: input.rutEmisor,
    rutReceptor: input.rutReceptor,
    payloadEnviado: input.payload,
    creadoPor: input.creadoPor,
  })

  if (!debeEmitir) return doc

  if (env.DTE_PROVIDER !== 'libredte') {
    const codigoMock = `MOCK-${doc.id}-${Date.now().toString(36)}`
    return repo.marcarTemporalCreado(doc.id, codigoMock, input.creadoPor)
  }

  const resultado = await libredte.emitirTemporal(input.payload, { normalizar: '1', formato: 'json' })
  if (!resultado.ok || !resultado.data?.codigo) {
    return repo.marcarError(doc.id, resultado.error ?? 'LibreDTE no devolvió un código de documento temporal', input.creadoPor)
  }
  return repo.marcarTemporalCreado(doc.id, resultado.data.codigo, input.creadoPor)
}

export async function obtenerDocumentoDte(origenTipo: string, origenId: number) {
  return repo.getDocumentoDte(origenTipo, origenId)
}

// RUT sin dígito verificador, numérico (ej. "77089369-0" → 77089369) — formato
// que exige generarReal() de LibreDTE en `emisor`/`receptor`.
export function rutSinDv(rut: string): number {
  const limpio = rut.replace(/[.\-]/g, '').trim()
  const cuerpo = limpio.slice(0, -1)
  return Number.parseInt(cuerpo, 10)
}

// Intenta extraer el folio real de la respuesta de POST /api/dte/documentos/generar.
// La forma exacta depende de la config de LibreDTE (folio en la raíz o dentro
// del DTE) — se buscan las ubicaciones conocidas y se deja el snapshot completo
// en respuestaGenerar para diagnóstico si ninguna calza.
function extraerFolio(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  const candidatos = [
    d.folio,
    (d.dte as Record<string, unknown> | undefined)?.folio,
    ((d.Encabezado as Record<string, unknown> | undefined)?.IdDoc as Record<string, unknown> | undefined)?.Folio,
  ]
  for (const c of candidatos) {
    const n = typeof c === 'string' ? Number.parseInt(c, 10) : typeof c === 'number' ? c : NaN
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

export interface GenerarDteRealInput {
  origenTipo: string
  origenId: number
  tipoDte: number
  rutEmisor: string
  rutReceptor: string
  creadoPor: string
}

// Segundo paso: timbra el DTE real (folio + envío SII) a partir del temporal ya
// creado. Idempotente/concurrente como emitirDteTemporal. Devuelve el
// DocumentoDte resultante — el caller decide qué hacer según `estado`
// (GENERADO = OK con folio; TEMPORAL_CREADO + errorMensaje = falló, reintentar).
export async function generarDteReal(input: GenerarDteRealInput) {
  const tomado = await repo.tomarDocumentoDteParaGenerar(input.origenTipo, input.origenId, input.creadoPor)
  if ('error' in tomado) throw new ValidationError(tomado.error)
  const { doc, debeGenerar } = tomado
  if (!debeGenerar) return doc

  if (env.DTE_PROVIDER !== 'libredte') {
    const folioMock = Math.floor(Date.now() / 1000) % 1_000_000
    return repo.marcarGenerado(doc.id, folioMock, { mock: true, codigo: doc.libredteCodigoTemporal }, input.creadoPor)
  }

  const resultado = await libredte.generarReal(
    {
      codigo: doc.libredteCodigoTemporal!,
      dte: input.tipoDte,
      emisor: rutSinDv(input.rutEmisor),
      receptor: rutSinDv(input.rutReceptor),
    },
    { getXML: '0' },
  )
  if (!resultado.ok) {
    return repo.marcarErrorGenerar(doc.id, resultado.error ?? 'LibreDTE no pudo timbrar el DTE', input.creadoPor)
  }
  const folio = extraerFolio(resultado.data)
  return repo.marcarGenerado(doc.id, folio, resultado.data ?? null, input.creadoPor)
}
