import { NotFoundError } from '../../../shared/errors.js'
import { getSolicitudById } from '../../productores/solicitudes-pago/solicitudes-pago.repository.js'
import { getEmpresaParaDocumento, getEntidadParaDocumento, logoDataUri } from '../documentos.repository.js'
import type { SolicitudPagoPdfPayload } from '../schemas/solicitud-pago.schema.js'

const ESTADO_LABELS: Record<string, string> = { SOLICITADA: 'Solicitada', PAGADA: 'Pagada', ANULADA: 'Anulada' }
const REFERENCIA_LABELS: Record<string, string> = {
  FACTURA: 'desde factura',
  ZARPE: 'desde zarpe',
  ENVIO_DOCUMENTOS: 'desde envío de documentos',
  ARRIBO: 'desde arribo',
}

// Resolver de la Solicitud de Pago a Productores (2026-11-10). id = SolicitudPago.id.
export async function resolverSolicitudPago(id: number, empresaId: number): Promise<SolicitudPagoPdfPayload> {
  const s = await getSolicitudById(id)
  if (!s) throw new NotFoundError('Solicitud de Pago', String(id))
  const [empresa, productor] = await Promise.all([getEmpresaParaDocumento(empresaId), getEntidadParaDocumento(s.entidadProductorId)])

  return {
    empresa: {
      razonSocial: empresa?.razonSocial ?? '—',
      rut: empresa?.rut ?? null,
      direccion: empresa?.direcciones[0]?.direccion ?? null,
      logoDataUri: logoDataUri(empresa?.logo),
    },
    numero: s.numero,
    fecha: s.fecha.toISOString(),
    estado: ESTADO_LABELS[s.estado] ?? s.estado,
    productor: {
      razonSocial: productor?.razonSocial ?? s.entidadProductor.razonSocial,
      rut: productor?.identificador ?? null,
      direccion: productor?.direcciones[0]?.direccion ?? null,
    },
    moneda: s.moneda.codigo,
    temporada: s.temporada.descripcion,
    observaciones: s.observaciones,
    cuotas: s.lineas.map((l) => {
      const c = l.ordenCompraCuotaPago
      const ref = c ? `${c.descripcion?.trim() || `Cuota ${l.numeroCuota}`} (${c.plazoDias} días ${REFERENCIA_LABELS[c.fechaReferencia] ?? ''})` : 'Total (OC sin condición de pago)'
      return {
        ordenCompra: l.ordenCompra.numero,
        embarque: l.embarque.numeroInstructivo,
        cuota: `${l.numeroCuota} · ${ref}`,
        vencimiento: l.fechaVencimiento ? l.fechaVencimiento.toISOString() : null,
        montoCalculado: Number(l.montoCalculado),
        montoSolicitado: Number(l.montoSolicitado),
        numeroFactura: l.numeroFactura,
      }
    }),
    montoTotal: Number(s.montoTotal),
    pago:
      s.estado === 'PAGADA' || s.fechaPago
        ? {
            fechaPago: s.fechaPago ? s.fechaPago.toISOString() : null,
            numeroTransferencia: s.numeroTransferencia,
            concepto: s.conceptoCtaCte?.descripcion ?? null,
          }
        : null,
  }
}
