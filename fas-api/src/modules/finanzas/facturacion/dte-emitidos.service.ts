import { env } from '../../../config/env.js'
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
