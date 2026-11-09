import { NotFoundError } from '../../../shared/errors.js'
import { getProformaMaterialById } from '../../materiales/proformas-venta/proformas-venta.repository.js'
import { getEmpresaParaDocumento, getEntidadParaDocumento, logoDataUri } from '../documentos.repository.js'
import type { ProformaMaterialPdfPayload } from '../schemas/proforma-material.schema.js'

// IVA 19% — mismo criterio que la Proforma a Productor / Factura Nacional.
const IVA_TASA = 0.19
const round2 = (n: number) => Math.round(n * 100) / 100

const ESTADO_LABELS: Record<string, string> = {
  BORRADOR: 'Borrador',
  ENVIADA_VALIDACION: 'Enviada a Validación',
  FACTURADA: 'Facturada',
  ANULADA: 'Anulada',
}

const FECHA_REFERENCIA_LABELS: Record<string, string> = {
  FACTURA: 'Fecha de Factura',
  ZARPE: 'Fecha de Zarpe',
  ENVIO_DOCUMENTOS: 'Envío de Documentos',
  ARRIBO: 'Fecha de Arribo',
}

// Resolver de la Proforma de Venta de Materiales — snapshot para previsualizar.
// id = id de la ProformaMaterial. Afecta (33) o exenta (34) según el tipo de
// documento de la cabecera (2026-11-09). La plantilla v2 (congelada) no tiene
// fila "Exento": en una exenta el monto va como base con IVA 0.
export async function resolverProformaMaterial(id: number, empresaId: number): Promise<ProformaMaterialPdfPayload> {
  const proforma = await getProformaMaterialById(id)
  if (!proforma) throw new NotFoundError('Proforma de Venta de Materiales', String(id))

  const [empresa, clienteEntidad] = await Promise.all([
    getEmpresaParaDocumento(empresaId),
    getEntidadParaDocumento(proforma.entidadId),
  ])

  let neto = 0
  for (const l of proforma.lineas) neto += Number(l.monto)
  neto = round2(neto)
  const iva = proforma.tipoDte === 34 ? 0 : Math.round(neto * IVA_TASA)
  const total = round2(neto + iva)

  return {
    empresa: {
      razonSocial: empresa?.razonSocial ?? '—',
      rut: empresa?.rut ?? null,
      direccion: empresa?.direcciones[0]?.direccion ?? null,
      logoDataUri: logoDataUri(empresa?.logo),
    },
    cliente: {
      razonSocial: proforma.entidad.razonSocial,
      descripcion: proforma.entidad.descripcion,
      rut: clienteEntidad?.identificador ?? null,
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
    })),
    cuotas: proforma.cuotasPago.map((c) => ({
      descripcion: c.descripcion,
      fechaReferencia: FECHA_REFERENCIA_LABELS[c.fechaReferencia] ?? c.fechaReferencia,
      plazoDias: c.plazoDias,
      porcentaje: c.porcentaje != null ? c.porcentaje.toString() : null,
    })),
    totales: {
      neto: neto.toString(),
      iva: iva.toString(),
      total: total.toString(),
    },
  }
}
