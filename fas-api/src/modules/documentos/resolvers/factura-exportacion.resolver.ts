import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import { getFacturaActivaById } from '../../ventas/cobranza/factura-exportacion.repository.js'
import { factorFob, subtotalFob as calcSubtotalFob, totalClausula, unitarioFob } from '../../ventas/cobranza/clausula-flete-seguro.js'
import { descripcionLinea } from '../../ventas/cobranza/descripcion-idioma.js'
import { esFacturaTimbrada } from '../../ventas/cobranza/sii-estado.js'
import { getEmpresaParaDocumento, getEntidadParaDocumento, logoDataUri } from '../documentos.repository.js'
import { resolverDatosEmbarqueExport } from './datos-embarque-export.js'
import { montoEnPalabras } from '../ui/monto-en-palabras.js'
import type { ProformaPdfPayload } from '../schemas/proforma.schema.js'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Resolver del PDF de la Factura de Exportación (DTE 110). Reusa la plantilla de
// la Proforma (misma estructura de detalle/cuotas) con `variante='FACTURA'` +
// folio. `id` = id de la Factura (debe estar activa).
export async function resolverFacturaExportacion(id: number, empresaId: number): Promise<ProformaPdfPayload> {
  const factura = await getFacturaActivaById(id)
  if (!factura) throw new NotFoundError('Factura de Exportación', String(id))
  // Gate de estado (FAS-EXP-IE-QA-002): la Factura Comercial solo se genera para
  // una Factura ya timbrada con folio (ENVIADA_SII o APROBADA) — no en
  // BORRADOR/RECHAZADA, ni siquiera por acceso directo al endpoint.
  if (!esFacturaTimbrada(factura.estado) || factura.folio == null) {
    throw new ValidationError('La Factura Comercial solo está disponible para una Factura ya timbrada (con folio)')
  }

  const [empresa, cliente, datosEmbarque] = await Promise.all([
    getEmpresaParaDocumento(empresaId),
    getEntidadParaDocumento(factura.clienteId),
    resolverDatosEmbarqueExport(factura.embarque.id),
  ])

  const idioma = factura.idioma === 'EN' ? 'EN' : 'ES'
  const montoTotal = Number(factura.montoTotal)
  const montoFlete = factura.montoFlete == null ? null : Number(factura.montoFlete)
  const montoSeguro = factura.montoSeguro == null ? null : Number(factura.montoSeguro)
  const fleteSumado = factura.fleteSumaAlPrecio
  const factor = factorFob(montoTotal, montoFlete, montoSeguro, fleteSumado)
  const subtotalFob = calcSubtotalFob(montoTotal, montoFlete, montoSeguro, fleteSumado)
  // Total cláusula (CIF) mostrado = FOB mercadería + flete + seguro. En modo
  // resta coincide con montoTotal; en modo suma es mayor.
  const totalCif = totalClausula(montoTotal, montoFlete, montoSeguro, fleteSumado)
  const fechaDoc = factura.fechaDocumento ?? factura.fechaEmision ?? new Date()

  // Vencimientos = cuotas ya persistidas de la Factura (no estimadas).
  const vencimientosEstimados = factura.cuotas.map((c) => ({
    numeroCuota: c.numeroCuota,
    descripcion: null,
    monto: Number(c.montoCuota),
    fechaReferencia: c.fechaReferencia,
    plazoDias: c.plazoDias,
    fechaEstimada: c.fechaVencimiento ? new Date(c.fechaVencimiento).toISOString() : null,
  }))

  return {
    empresa: {
      razonSocial: empresa?.razonSocial ?? '—',
      rut: empresa?.rut ?? null,
      direccion: empresa?.direcciones[0]?.direccion ?? null,
      telefono: empresa?.telefono ?? null,
      logoDataUri: logoDataUri(empresa?.logo),
    },
    codigo: factura.codigo,
    numeroInstructivo: factura.embarque.numeroInstructivo,
    fechaEmision: new Date(fechaDoc).toISOString(),
    idioma,
    cliente: {
      razonSocial: cliente?.razonSocial ?? '—',
      // Cliente extranjero: mostrar el TAXID (fallback a identificador para
      // clientes creados antes del campo TAXID, 2026-10-09).
      rut: cliente?.taxId ?? cliente?.identificador ?? null,
      direccion: cliente?.direcciones[0]?.direccion ?? null,
    },
    moneda: factura.moneda.codigo,
    condicionPago: factura.condicionPago?.descripcion ?? null,
    observaciones: factura.observaciones ?? null,
    variante: 'FACTURA',
    folio: factura.folio,
    tipoDte: factura.tipoDte,
    lineas: factura.lineas.map((l) => ({
      descripcion: descripcionLinea(l, idioma),
      cantidadCajas: l.cantidadCajas,
      precioUnitario: unitarioFob(Number(l.precioUnitario), factor),
      montoLinea: round2(Number(l.montoLinea) * factor),
    })),
    montoFlete,
    montoSeguro,
    subtotalFob,
    montoTotal: totalCif,
    vencimientosEstimados,
    transporte: datosEmbarque
      ? {
          nave: datosEmbarque.nave,
          via: datosEmbarque.via,
          blAwb: datosEmbarque.blAwb,
          tipoBl: datosEmbarque.tipoBl,
          booking: datosEmbarque.booking,
          contenedor: datosEmbarque.contenedor,
          sello: datosEmbarque.sello,
          puertoEmbarque: datosEmbarque.puertoEmbarque,
          puertoDestino: datosEmbarque.puertoDestino,
          etd: datosEmbarque.etd,
          eta: datosEmbarque.eta,
          flete: datosEmbarque.flete,
          modalidadVenta: datosEmbarque.modalidadVenta,
          incoterm: datosEmbarque.incoterm,
        }
      : null,
    notify: datosEmbarque?.notify ?? null,
    consignatario: datosEmbarque?.consignatario ?? null,
    pesoNeto: datosEmbarque?.pesoNeto ?? null,
    pesoBruto: datosEmbarque?.pesoBruto ?? null,
    montoEnPalabras: montoEnPalabras(totalCif, idioma, factura.moneda.codigo),
  }
}
