import type { Prisma } from '@prisma/client'
import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as dteService from '../../finanzas/facturacion/dte-emitidos.service.js'
import * as dteRepo from '../../finanzas/facturacion/dte-emitidos.repository.js'
import type { LibredteDtePayload } from '../../finanzas/facturacion/libredte.types.js'
import * as ncRepo from './nota-credito.repository.js'

// origenTipo del DocumentoDte de una NC según el tipo de factura que anula.
function origenTipoDeNc(nc: { facturaExportacionId: number | null }): string {
  return nc.facturaExportacionId != null ? 'nota-credito-exportacion' : 'nota-credito-nacional'
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
