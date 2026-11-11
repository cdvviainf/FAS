// v1 — Solicitud de Pago a Productores (2026-11-10).
import { Documento } from '../../../ui/Documento.js'
import { EncabezadoCorporativo } from '../../../ui/EncabezadoCorporativo.js'
import { GrupoCampos } from '../../../ui/GrupoCampos.js'
import { TablaLineas, type ColumnaTabla } from '../../../ui/TablaLineas.js'
import { PieFirma } from '../../../ui/PieFirma.js'
import { fmt } from '../../../ui/formato.js'
import type { SolicitudPagoPdfPayload } from '../../../schemas/solicitud-pago.schema.js'

type Cuota = SolicitudPagoPdfPayload['cuotas'][number]

export function SolicitudPagoV1({ d }: { d: SolicitudPagoPdfPayload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) {
  const columnas: ColumnaTabla<Cuota>[] = [
    { titulo: 'OC', render: (c) => c.ordenCompra },
    { titulo: 'Embarque', render: (c) => c.embarque },
    { titulo: 'Cuota', render: (c) => c.cuota },
    { titulo: 'Vence', render: (c) => (c.vencimiento ? fmt.fecha(c.vencimiento) : '—') },
    { titulo: 'Monto cuota', render: (c) => fmt.moneda(c.montoCalculado, d.moneda), numerica: true },
    { titulo: 'Solicitado', render: (c) => fmt.moneda(c.montoSolicitado, d.moneda), numerica: true },
    { titulo: 'N° Factura', render: (c) => c.numeroFactura ?? '—' },
  ]

  return (
    <Documento
      titulo={`Solicitud de Pago ${d.numero}`}
      paginaOpts={{ formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' }}
      piePagina='Documento generado electrónicamente'
    >
      <EncabezadoCorporativo
        logoDataUri={d.empresa.logoDataUri ?? undefined}
        tituloDocumento='Solicitud de Pago a Productor'
        numero={d.numero}
        fecha={fmt.fecha(d.fecha)}
        subtitulo={`Estado: ${d.estado}`}
      />

      <div className='doc-fila-grupos'>
        <GrupoCampos
          titulo='Empresa'
          campos={[
            { label: 'Razón social', valor: d.empresa.razonSocial },
            { label: 'RUT', valor: fmt.rut(d.empresa.rut) },
            { label: 'Dirección', valor: d.empresa.direccion ?? '—' },
          ]}
        />
        <GrupoCampos
          titulo='Productor'
          campos={[
            { label: 'Razón social', valor: d.productor.razonSocial },
            { label: 'RUT', valor: fmt.rut(d.productor.rut) },
            { label: 'Dirección', valor: d.productor.direccion ?? '—' },
            { label: 'Moneda', valor: d.moneda },
            { label: 'Temporada', valor: d.temporada },
          ]}
        />
      </div>

      <TablaLineas
        titulo='Cuotas solicitadas'
        filas={d.cuotas}
        columnas={columnas}
        totales={['', '', '', '', 'Total', fmt.moneda(d.montoTotal, d.moneda), '']}
      />

      {d.pago && (
        <GrupoCampos
          titulo='Pago'
          campos={[
            { label: 'Fecha de pago', valor: d.pago.fechaPago ? fmt.fecha(d.pago.fechaPago) : '—' },
            { label: 'N° transferencia', valor: d.pago.numeroTransferencia ?? '—' },
            { label: 'Concepto cta. cte.', valor: d.pago.concepto ?? '—' },
          ]}
        />
      )}

      {d.observaciones && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 3 }}>Observaciones</div>
          <div style={{ fontSize: 9, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{d.observaciones}</div>
        </div>
      )}

      <PieFirma firmantes={['Solicitado por', 'Autorizado por']} />
    </Documento>
  )
}
