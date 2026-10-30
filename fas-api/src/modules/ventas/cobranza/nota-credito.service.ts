import type { Prisma } from '@prisma/client'
import { env } from '../../../config/env.js'
import { logger } from '../../../lib/logger.js'
import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as dteService from '../../finanzas/facturacion/dte-emitidos.service.js'
import { rutSinDv } from '../../finanzas/facturacion/dte-emitidos.service.js'
import * as dteRepo from '../../finanzas/facturacion/dte-emitidos.repository.js'
import * as libredte from '../../finanzas/facturacion/libredte.adapter.js'
import type { LibredteDtePayload } from '../../finanzas/facturacion/libredte.types.js'
import * as ncRepo from './nota-credito.repository.js'

// origenTipo del DocumentoDte de una NC según el tipo de factura que anula.
function origenTipoDeNc(nc: { facturaExportacionId: number | null }): string {
  return nc.facturaExportacionId != null ? 'nota-credito-exportacion' : 'nota-credito-nacional'
}

// Indicadores de rechazo del SII en la respuesta de estado de LibreDTE (códigos
// de revisión de envío del SII + glosas). Si aparecen, el documento está
// rechazado y no puede ser referenciado por una NC.
const RECHAZO_SII = /rechaz|"rch"|"rfr"|"rct"|"rlv"|no v[aá]lid|anulad/i

// Pre-chequeo (FAS-COB-NC, rechazo real del SII): un DTE que el SII rechazó ya es
// inválido y LibreDTE no permite referenciarlo desde una NC. Se consulta el
// estado real en el SII para dar un error accionable ANTES de intentar la NC, en
// vez de fallar recién en LibreDTE. FAIL-OPEN a propósito: si no se puede
// determinar (mock, sin folio, error de red, formato inesperado) NO bloquea —
// LibreDTE sigue siendo la última barrera.
async function verificarFacturaNoRechazadaSii(facturaTipoDte: number, folio: number | null, rutEmisor: string) {
  if (env.DTE_PROVIDER !== 'libredte' || folio == null) return
  let r
  try {
    r = await libredte.consultarEstadoEmitido(facturaTipoDte, folio, rutSinDv(rutEmisor))
  } catch (err) {
    logger.warn({ facturaTipoDte, folio, err: err instanceof Error ? err.message : String(err) }, 'NC: no se pudo consultar el estado SII de la factura (se continúa)')
    return
  }
  if (!r.ok || r.data == null) return
  const texto = JSON.stringify(r.data)
  logger.debug({ facturaTipoDte, folio, estadoSii: texto.slice(0, 1000) }, 'NC: estado SII de la factura referenciada')
  if (RECHAZO_SII.test(texto)) {
    throw new ValidationError(
      `La factura (DTE ${facturaTipoDte} folio ${folio}) fue RECHAZADA por el SII — un documento rechazado ya es inválido y no se puede anular con Nota de Crédito. Reemite una factura corregida.`,
    )
  }
}

// Nota de Crédito de anulación (Ciclo 4) — orquestación común a export/nacional.
// Cada factura-service arma su payload (112 con Aduana / 61 simple) y delega acá
// la emisión por el motor DocumentoDte (temporal → real) y el marcado atómico de
// la NC APROBADA + factura ANULADA. Mismo patrón de 2 pasos y reconciliación
// idempotente que el firmado de facturas (el motor serializa por advisory lock).

export interface EmitirNcAnulacionInput {
  tipoFactura: ncRepo.TipoFacturaNc
  facturaId: number
  tipoDteNc: number // 112 export / 61 nacional
  // DTE y folio de la FACTURA referenciada (110 / 33 / 34) — para el pre-chequeo
  // de estado SII y la referencia de anulación.
  facturaTipoDte: number
  facturaFolio: number | null
  origenTipo: string // 'nota-credito-exportacion' / 'nota-credito-nacional'
  clienteId: number
  monedaId: number
  montoTotal: Prisma.Decimal | number
  idioma: string
  codigo: string
  payload: LibredteDtePayload
  rutEmisor: string
  rutReceptor: string
  userId: string
}

export async function emitirNcAnulacion(input: EmitirNcAnulacionInput) {
  // Si la factura referenciada fue rechazada por el SII, LibreDTE no permite la
  // NC — se bloquea con un error accionable antes de crear la NC (fail-open).
  await verificarFacturaNoRechazadaSii(input.facturaTipoDte, input.facturaFolio, input.rutEmisor)

  const nc = await ncRepo.crearOReusarNc({
    tipoFactura: input.tipoFactura,
    facturaId: input.facturaId,
    tipoDte: input.tipoDteNc,
    clienteId: input.clienteId,
    monedaId: input.monedaId,
    montoTotal: input.montoTotal,
    idioma: input.idioma,
    codigo: input.codigo,
    creadoPorId: input.userId,
  })

  // Paso 1: DTE temporal (no consume folio). Reconciliación idempotente: si ya
  // está GENERADO de un intento previo, el motor no re-emite.
  const temporal = await dteService.emitirDteTemporal({
    origenTipo: input.origenTipo,
    origenId: nc.id,
    tipoDte: input.tipoDteNc,
    payload: input.payload,
    rutEmisor: input.rutEmisor,
    rutReceptor: input.rutReceptor,
    creadoPor: input.userId,
  })
  if (temporal.estado !== 'TEMPORAL_CREADO' && temporal.estado !== 'GENERADO') {
    const err = temporal.errorMensaje ?? 'No se pudo crear la Nota de Crédito temporal en LibreDTE'
    await ncRepo.marcarNcRechazada(nc.id, err)
    throw new ValidationError(err)
  }

  // Paso 2: timbrar (consume folio del CAF del tipo 112/61 en LibreDTE).
  const generado = await dteService.generarDteReal({
    origenTipo: input.origenTipo,
    origenId: nc.id,
    tipoDte: input.tipoDteNc,
    rutEmisor: input.rutEmisor,
    rutReceptor: input.rutReceptor,
    creadoPor: input.userId,
  })
  if (generado.estado === 'GENERANDO') {
    throw new ValidationError('El timbrado de la Nota de Crédito ya está en curso — espera unos segundos y recarga')
  }
  if (generado.estado !== 'GENERADO') {
    const err = generado.errorMensaje ?? 'No se pudo timbrar la Nota de Crédito en LibreDTE'
    await ncRepo.marcarNcRechazada(nc.id, err)
    throw new ValidationError(err)
  }
  if (generado.folio == null) {
    throw new ValidationError('La Nota de Crédito se timbró sin folio (dato inconsistente) — contacta a soporte')
  }

  // Éxito: NC APROBADA + factura ANULADA (estado SII + estadoCobranza), atómico.
  return ncRepo.marcarNcAprobadaYAnularFactura(
    input.tipoFactura,
    nc.id,
    input.facturaId,
    { folio: generado.folio, trackIdSii: generado.libredteCodigoTemporal ?? null, fechaEmision: new Date() },
    input.userId,
  )
}

// ─── NC parcial por RECLAMO (crédito al cliente, Exportación) ──────────────────
// Igual patrón de 2 pasos que la anulación, pero: la NC lleva reclamoId +
// CORRIGE_MONTO, NO anula la factura y REDUCE su cobranza por el monto del crédito.
export interface EmitirNcReclamoInput {
  reclamoId: number
  facturaExportacionId: number
  tipoDteNc: number // 112
  facturaTipoDte: number
  facturaFolio: number | null
  origenTipo: string // 'nota-credito-exportacion'
  clienteId: number
  monedaId: number
  creditoMonto: number
  idioma: string
  codigo: string
  payload: LibredteDtePayload
  rutEmisor: string
  rutReceptor: string
  userId: string
}

export async function emitirNcReclamo(input: EmitirNcReclamoInput) {
  await verificarFacturaNoRechazadaSii(input.facturaTipoDte, input.facturaFolio, input.rutEmisor)

  const nc = await ncRepo.crearOReusarNcReclamo({
    reclamoId: input.reclamoId,
    tipoDte: input.tipoDteNc,
    clienteId: input.clienteId,
    monedaId: input.monedaId,
    montoTotal: input.creditoMonto,
    idioma: input.idioma,
    codigo: input.codigo,
    creadoPorId: input.userId,
  })

  const temporal = await dteService.emitirDteTemporal({
    origenTipo: input.origenTipo,
    origenId: nc.id,
    tipoDte: input.tipoDteNc,
    payload: input.payload,
    rutEmisor: input.rutEmisor,
    rutReceptor: input.rutReceptor,
    creadoPor: input.userId,
  })
  if (temporal.estado !== 'TEMPORAL_CREADO' && temporal.estado !== 'GENERADO') {
    const err = temporal.errorMensaje ?? 'No se pudo crear la Nota de Crédito temporal en LibreDTE'
    await ncRepo.marcarNcRechazada(nc.id, err)
    throw new ValidationError(err)
  }

  const generado = await dteService.generarDteReal({
    origenTipo: input.origenTipo,
    origenId: nc.id,
    tipoDte: input.tipoDteNc,
    rutEmisor: input.rutEmisor,
    rutReceptor: input.rutReceptor,
    creadoPor: input.userId,
  })
  if (generado.estado === 'GENERANDO') {
    throw new ValidationError('El timbrado de la Nota de Crédito ya está en curso — espera unos segundos y recarga')
  }
  if (generado.estado !== 'GENERADO') {
    const err = generado.errorMensaje ?? 'No se pudo timbrar la Nota de Crédito en LibreDTE'
    await ncRepo.marcarNcRechazada(nc.id, err)
    throw new ValidationError(err)
  }
  if (generado.folio == null) {
    throw new ValidationError('La Nota de Crédito se timbró sin folio (dato inconsistente) — contacta a soporte')
  }

  // Éxito: NC APROBADA + cobranza de la factura reducida (NO se anula), atómico.
  return ncRepo.marcarNcReclamoAprobada(
    nc.id,
    input.facturaExportacionId,
    input.creditoMonto,
    { folio: generado.folio, trackIdSii: generado.libredteCodigoTemporal ?? null, fechaEmision: new Date() },
    input.userId,
  )
}

// ─── Lecturas de la Nota de Crédito ──────────────────────────────────────────
export async function obtenerNc(id: number) {
  const nc = await ncRepo.getNcById(id)
  if (!nc) throw new NotFoundError('Nota de Crédito', String(id))
  return nc
}

// XML timbrado de la NC (DocumentoDte.xml), para descarga.
export async function obtenerXmlNc(id: number) {
  const nc = await ncRepo.getNcById(id)
  if (!nc) throw new NotFoundError('Nota de Crédito', String(id))
  const dte = await dteService.obtenerDocumentoDte(origenTipoDeNc(nc), nc.id)
  if (!dte?.xml) throw new ValidationError('La Nota de Crédito aún no tiene XML timbrado disponible')
  return { xml: dte.xml, codigo: nc.codigo, folio: nc.folio }
}

// PDF del DTE REAL timbrado de la NC (desde LibreDTE). Requiere NC APROBADA + folio.
export async function obtenerPdfNc(id: number) {
  const nc = await ncRepo.getNcById(id)
  if (!nc) throw new NotFoundError('Nota de Crédito', String(id))
  if (nc.estado !== 'APROBADA' || nc.folio == null) {
    throw new ValidationError('El PDF timbrado solo está disponible para una Nota de Crédito aprobada (timbrada por el SII)')
  }
  const emisor = await dteRepo.getEmpresaParaDte(nc.empresaId)
  if (!emisor?.rut) throw new ValidationError('La Empresa no tiene RUT configurado')
  const r = await dteService.obtenerPdfEmitido({ tipoDte: nc.tipoDte, folio: nc.folio, rutEmisor: emisor.rut })
  if (!r.ok) throw new ValidationError(r.error)
  return { pdf: r.pdf, codigo: nc.codigo, folio: nc.folio }
}
