import { env } from '../../../config/env.js'
import { logger } from '../../../lib/logger.js'
import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as dteService from '../facturacion/dte-emitidos.service.js'
import * as libredte from '../facturacion/libredte.adapter.js'
import { interpretarEstadoSii, esFacturaTimbrada } from '../../ventas/cobranza/sii-estado.js'
import * as facturaNacionalService from '../../ventas/cobranza/factura-nacional.service.js'
import * as facturaExportacionService from '../../ventas/cobranza/factura-exportacion.service.js'
import * as facturaNacionalRepo from '../../ventas/cobranza/factura-nacional.repository.js'
import * as facturaExportacionRepo from '../../ventas/cobranza/factura-exportacion.repository.js'
import * as repo from './monitor-dte.repository.js'
import type { MonitorDteListQuery } from './monitor-dte.schema.js'

// Monitor DTE (2026-11-07) — documentos electrónicos firmados (DocumentoDte
// GENERADO, con folio real) de todos los orígenes, con su veredicto del SII,
// descarga de XML/PDF timbrado y consulta del estado en el SII.

const NOMBRE_DTE: Record<number, string> = {
  33: 'Factura electrónica',
  34: 'Factura exenta electrónica',
  52: 'Guía de despacho electrónica',
  56: 'Nota de débito electrónica',
  61: 'Nota de crédito electrónica',
  110: 'Factura de exportación electrónica',
  111: 'Nota de débito de exportación electrónica',
  112: 'Nota de crédito de exportación electrónica',
}

const ETIQUETA_ORIGEN: Record<string, string> = {
  'factura-exportacion': 'Factura de Exportación',
  'factura-nacional': 'Factura Nacional',
  'nota-credito-exportacion': 'Nota de Crédito (exportación)',
  'nota-credito-nacional': 'Nota de Crédito (nacional)',
  embarque: 'Guía de despacho (Embarque)',
  movimiento: 'Guía de despacho (Movimiento)',
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

// Monto total y fecha de emisión desde la respuesta de LibreDTE (`total`,
// `fecha`) o el payload enviado (IdDoc.FchEmis) — la forma exacta depende de
// LibreDTE, así que todo es opcional.
function datosDelDte(payload: unknown, respuesta: unknown) {
  const r = obj(respuesta)
  const enc = obj(obj(payload)?.Encabezado)
  const receptor = obj(enc?.Receptor)
  const idDoc = obj(enc?.IdDoc)
  const totalRaw = r?.total
  const total = typeof totalRaw === 'number' ? totalRaw : typeof totalRaw === 'string' && totalRaw.trim() && Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : null
  const fecha = typeof r?.fecha === 'string' ? r.fecha : typeof idDoc?.FchEmis === 'string' ? idDoc.FchEmis : null
  const razonSocial = typeof receptor?.RznSocRecep === 'string' ? receptor.RznSocRecep : null
  return { total, fecha, razonSocial }
}

export async function listar(f: MonitorDteListQuery) {
  const { data, total } = await repo.listarFirmados(f)
  const porTipo = new Map<string, number[]>()
  for (const d of data) porTipo.set(d.origenTipo, [...(porTipo.get(d.origenTipo) ?? []), d.origenId])
  const o = await repo.getOrigenes(porTipo)
  const fexp = new Map(o.fexp.map((x) => [x.id, x]))
  const fnac = new Map(o.fnac.map((x) => [x.id, x]))
  const ncs = new Map(o.ncs.map((x) => [x.id, x]))
  const emb = new Map(o.embarques.map((x) => [x.id, x]))
  const mov = new Map(o.movimientos.map((x) => [x.id, x]))

  const filas = data.map((d) => {
    const extra = datosDelDte(d.payloadEnviado, d.respuestaGenerar)
    let codigo: string | null = null
    let ruta: string | null = null
    let montoOrigen: string | null = null
    let moneda: string | null = null
    switch (d.origenTipo) {
      case 'factura-exportacion': {
        const x = fexp.get(d.origenId)
        codigo = x?.codigo ?? null
        ruta = `/dashboard/facturacion/exportacion/factura/${d.origenId}`
        montoOrigen = x?.montoTotal?.toString() ?? null
        moneda = x?.moneda.codigo ?? null
        break
      }
      case 'factura-nacional': {
        const x = fnac.get(d.origenId)
        codigo = x?.codigo ?? null
        ruta = `/dashboard/facturacion/nacional/factura/${d.origenId}`
        montoOrigen = x?.montoTotal?.toString() ?? null
        moneda = x?.moneda.codigo ?? null
        break
      }
      case 'nota-credito-exportacion':
      case 'nota-credito-nacional': {
        const x = ncs.get(d.origenId)
        codigo = x?.codigo ?? null
        // La NC no tiene pantalla propia: se enlaza a la factura que referencia.
        ruta = x?.facturaExportacionId != null
          ? `/dashboard/facturacion/exportacion/factura/${x.facturaExportacionId}`
          : x?.facturaNacionalId != null
            ? `/dashboard/facturacion/nacional/factura/${x.facturaNacionalId}`
            : null
        montoOrigen = x?.montoTotal?.toString() ?? null
        moneda = x?.moneda.codigo ?? null
        break
      }
      case 'embarque': {
        const x = emb.get(d.origenId)
        codigo = x ? `Embarque ${x.numeroInstructivo}` : null
        ruta = `/dashboard/ventas/embarques/${d.origenId}`
        break
      }
      case 'movimiento': {
        const x = mov.get(d.origenId)
        codigo = `Movimiento #${d.origenId}${x?.tipoMovimiento?.descripcion ? ` · ${x.tipoMovimiento.descripcion}` : ''}`
        ruta = `/dashboard/operaciones/movimientos/${d.origenId}`
        break
      }
    }
    return {
      id: d.id,
      tipoDte: d.tipoDte,
      tipoNombre: NOMBRE_DTE[d.tipoDte] ?? `DTE ${d.tipoDte}`,
      folio: d.folio,
      fechaEmision: extra.fecha ?? d.generadoEn?.toISOString().slice(0, 10) ?? null,
      generadoEn: d.generadoEn,
      rutReceptor: d.rutReceptor,
      razonSocialReceptor: extra.razonSocial,
      // Total del DTE según LibreDTE (en la moneda del documento SII); si no
      // viene, el monto del documento de origen con su moneda.
      montoTotal: extra.total != null ? String(extra.total) : montoOrigen,
      moneda: extra.total != null ? null : moneda,
      origen: { tipo: d.origenTipo, etiqueta: ETIQUETA_ORIGEN[d.origenTipo] ?? d.origenTipo, id: d.origenId, codigo, ruta },
      estadoSii: d.estadoSii ?? 'PENDIENTE',
      estadoSiiGlosa: d.estadoSiiGlosa,
      estadoSiiConsultadoEn: d.estadoSiiConsultadoEn,
    }
  })
  return { data: filas, meta: { total, page: f.page, limit: f.limit, totalPages: Math.max(1, Math.ceil(total / f.limit)) } }
}

async function firmadoOError(id: number) {
  const doc = await repo.getFirmadoById(id)
  if (!doc || doc.folio == null) throw new NotFoundError('Documento electrónico firmado', String(id))
  return doc as typeof doc & { folio: number }
}

// ¿La factura de origen sigue timbrada (ENVIADA_SII/APROBADA)? Entonces se usa
// su propia consulta, que además actualiza el estado de la factura.
async function facturaTimbrada(origenTipo: string, origenId: number): Promise<boolean> {
  if (origenTipo === 'factura-nacional') {
    const f = await facturaNacionalRepo.getFacturaActivaById(origenId)
    return !!f && esFacturaTimbrada(f.estado) && f.folio != null
  }
  if (origenTipo === 'factura-exportacion') {
    const f = await facturaExportacionRepo.getFacturaActivaById(origenId)
    return !!f && esFacturaTimbrada(f.estado) && f.folio != null
  }
  return false
}

// Consulta el veredicto del SII de un DTE firmado y lo persiste en el
// DocumentoDte. Facturas timbradas → su consultarEstadoSii (mismo criterio y
// mismos efectos que el botón del detalle). Guías, NC y facturas no timbradas
// (anuladas/rechazadas) → consulta genérica a LibreDTE (actualizar_estado) con
// la misma interpretación fail-safe (interpretarEstadoSii). Lo usa el Monitor y
// el seguimiento automático ('documento-dte').
export async function consultarEstadoSii(id: number) {
  const doc = await firmadoOError(id)
  if (env.DTE_PROVIDER !== 'libredte') {
    throw new ValidationError('La consulta de estado SII requiere el proveedor LibreDTE configurado')
  }
  if (await facturaTimbrada(doc.origenTipo, doc.origenId)) {
    const r = doc.origenTipo === 'factura-nacional'
      ? await facturaNacionalService.consultarEstadoSii(doc.origenId)
      : await facturaExportacionService.consultarEstadoSii(doc.origenId)
    return { id: doc.id, sii: r.sii }
  }
  const r = await libredte.actualizarEstadoEmitido(doc.tipoDte, doc.folio, dteService.rutSinDv(doc.rutEmisor))
  if (!r.ok || r.data == null) {
    throw new ValidationError(`No se pudo consultar el estado en el SII: ${r.error ?? 'respuesta vacía de LibreDTE'}`)
  }
  const { veredicto, glosa } = interpretarEstadoSii(r.data)
  logger.info({ documentoDteId: doc.id, tipoDte: doc.tipoDte, folio: doc.folio, veredicto }, 'Monitor DTE: estado SII consultado')
  await dteService.registrarEstadoSii(doc.origenTipo, doc.origenId, veredicto, glosa)
  return { id: doc.id, sii: { veredicto, glosa } }
}

export async function obtenerXml(id: number) {
  const doc = await firmadoOError(id)
  if (!doc.xml) throw new ValidationError('Este documento no tiene XML timbrado disponible')
  return { xml: doc.xml, nombre: `DTE${doc.tipoDte}_F${doc.folio}.xml` }
}

export async function obtenerPdf(id: number) {
  const doc = await firmadoOError(id)
  const r = await dteService.obtenerPdfEmitido({ tipoDte: doc.tipoDte, folio: doc.folio, rutEmisor: doc.rutEmisor })
  if (!r.ok) throw new ValidationError(r.error)
  return { pdf: r.pdf, nombre: `DTE${doc.tipoDte}_F${doc.folio}.pdf` }
}
