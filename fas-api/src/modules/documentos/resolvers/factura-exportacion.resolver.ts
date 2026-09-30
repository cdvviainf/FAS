import { NotFoundError } from '../../../shared/errors.js'
import { getFacturaActivaById } from '../../ventas/cobranza/factura-exportacion.repository.js'
import { factorFob, unitarioFob } from '../../ventas/cobranza/clausula-flete-seguro.js'
import { descripcionLinea } from '../../ventas/cobranza/descripcion-idioma.js'
import { getEmpresaParaDocumento, getEntidadParaDocumento, logoDataUri } from '../documentos.repository.js'
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

  const [empresa, cliente] = await Promise.all([
    getEmpresaParaDocumento(empresaId),
    getEntidadParaDocumento(factura.clienteId),
  ])

  const idioma = factura.idioma === 'EN' ? 'EN' : 'ES'
  const montoTotal = Number(factura.montoTotal)
  const montoFlete = factura.montoFlete == null ? null : Number(factura.montoFlete)
  const montoSeguro = factura.montoSeguro == null ? null : Number(factura.montoSeguro)
  const factor = factorFob(montoTotal, montoFlete, montoSeguro)
  const subtotalFob = round2(montoTotal - (montoFlete ?? 0) - (montoSeguro ?? 0))
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
      logoDataUri: logoDataUri(empresa?.logo),
    },
    codigo: factura.codigo,
    numeroInstructivo: factura.embarque.numeroInstructivo,
    fechaEmision: new Date(fechaDoc).toISOString(),
    idioma,
    cliente: {
      razonSocial: cliente?.razonSocial ?? '—',
      rut: cliente?.identificador ?? null,
      direccion: cliente?.direcciones[0]?.direccion ?? null,
    },
    moneda: factura.moneda.codigo,
    condicionPago: factura.condicionPago?.descripcion ?? null,
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
    montoTotal,
    vencimientosEstimados,
  }
}
