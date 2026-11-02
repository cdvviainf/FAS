import { NotFoundError } from '../../../shared/errors.js'
import { getProformaProductorById } from '../../productores/proformas/proformas.repository.js'
import { getEmpresaParaDocumento, getEntidadParaDocumento, logoDataUri } from '../documentos.repository.js'
import type { ProformaProductorPdfPayload } from '../schemas/proforma-productor.schema.js'

// IVA 19% — mismo criterio que la Factura Nacional (factura-nacional.service.ts:
// montoIva = Math.round(montoNeto * 0.19), en pesos enteros).
const IVA_TASA = 0.19
const round2 = (n: number) => Math.round(n * 100) / 100

const ESTADO_LABELS: Record<string, string> = {
  BORRADOR: 'Borrador',
  ENVIADA_VALIDACION: 'Enviada a Validación',
  RECHAZADA: 'Rechazada',
  FACTURADA: 'Facturada',
  ANULADA: 'Anulada',
}

const FECHA_REFERENCIA_LABELS: Record<string, string> = {
  FACTURA: 'Fecha de Factura',
  ZARPE: 'Fecha de Zarpe',
  ENVIO_DOCUMENTOS: 'Envío de Documentos',
  ARRIBO: 'Fecha de Arribo',
}

// Resolver de la Proforma a Productor (servicios) — snapshot para previsualizar.
// id = id de la ProformaProductor.
export async function resolverProformaProductor(id: number, empresaId: number): Promise<ProformaProductorPdfPayload> {
  const proforma = await getProformaProductorById(id)
  if (!proforma) throw new NotFoundError('Proforma a Productor', String(id))

  const [empresa, productorEntidad] = await Promise.all([
    getEmpresaParaDocumento(empresaId),
    getEntidadParaDocumento(proforma.entidadId),
  ])

  // Totales: neto = Σ montos de líneas afectas, exento = Σ montos exentas,
  // IVA = 19% del neto (pesos enteros), total = neto + iva + exento.
  let neto = 0
  let exento = 0
  for (const l of proforma.lineas) {
    const monto = Number(l.monto)
    if (l.exento) exento += monto
    else neto += monto
  }
  neto = round2(neto)
  exento = round2(exento)
  const iva = Math.round(neto * IVA_TASA)
  const total = round2(neto + iva + exento)

  return {
    empresa: {
      razonSocial: empresa?.razonSocial ?? '—',
      rut: empresa?.rut ?? null,
      direccion: empresa?.direcciones[0]?.direccion ?? null,
      logoDataUri: logoDataUri(empresa?.logo),
    },
    productor: {
      razonSocial: proforma.entidad.razonSocial,
      descripcion: proforma.entidad.descripcion,
      rut: productorEntidad?.identificador ?? null,
    },
    numero: proforma.numero,
    fecha: proforma.creadoEn.toISOString(),
    estado: ESTADO_LABELS[proforma.estado] ?? proforma.estado,
    moneda: proforma.moneda.codigo,
    formaPago: proforma.formaPago?.descripcion ?? null,
    condicionPago: proforma.condicionPago?.descripcion ?? null,
    observaciones: proforma.observaciones,
    lineas: proforma.lineas.map((l) => ({
      descripcion: l.articulo.descripcion,
      cantidad: l.cantidad.toString(),
      precioUnitario: l.precioUnitario.toString(),
      monto: l.monto.toString(),
      exento: l.exento,
    })),
    cuotas: proforma.cuotasPago.map((c) => ({
      descripcion: c.descripcion,
      fechaReferencia: FECHA_REFERENCIA_LABELS[c.fechaReferencia] ?? c.fechaReferencia,
      plazoDias: c.plazoDias,
      porcentaje: c.porcentaje != null ? c.porcentaje.toString() : null,
    })),
    totales: {
      neto: neto.toString(),
      exento: exento.toString(),
      iva: iva.toString(),
      total: total.toString(),
    },
  }
}
