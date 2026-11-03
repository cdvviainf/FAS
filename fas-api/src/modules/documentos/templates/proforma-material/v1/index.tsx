import { Documento } from '../../../ui/Documento.js'
import { Encabezado } from '../../../ui/Encabezado.js'
import { GrupoCampos } from '../../../ui/GrupoCampos.js'
import { TablaLineas, type ColumnaTabla } from '../../../ui/TablaLineas.js'
import { BloqueTotales } from '../../../ui/BloqueTotales.js'
import { PieFirma } from '../../../ui/PieFirma.js'
import { fmt } from '../../../ui/formato.js'
import type { ProformaMaterialPdfPayload } from '../../../schemas/proforma-material.schema.js'

type Linea = ProformaMaterialPdfPayload['lineas'][number]
type Cuota = ProformaMaterialPdfPayload['cuotas'][number]

// v1 — Proforma de Venta de Materiales. Sin control de copia (Etapa 4 §8).
export function ProformaMaterialV1({ d }: { d: ProformaMaterialPdfPayload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) {
  const columnasLineas: ColumnaTabla<Linea>[] = [
    { titulo: 'Detalle', render: (l) => l.descripcion },
    { titulo: 'Cantidad', render: (l) => fmt.entero(l.cantidad), numerica: true },
    { titulo: 'Precio Unit.', render: (l) => fmt.moneda(l.precioUnitario, d.moneda), numerica: true },
    { titulo: 'Monto', render: (l) => fmt.moneda(l.monto, d.moneda), numerica: true },
  ]

  const columnasCuotas: ColumnaTabla<Cuota>[] = [
    { titulo: 'Cuota', render: (c) => c.descripcion ?? '—' },
    { titulo: 'Referencia', render: (c) => c.fechaReferencia },
    { titulo: 'Días', render: (c) => fmt.entero(c.plazoDias), numerica: true },
    { titulo: '%', render: (c) => (c.porcentaje != null ? `${fmt.entero(c.porcentaje)}%` : '—'), numerica: true },
  ]

  return (
    <Documento
      titulo={`Proforma de Venta de Materiales ${d.numero}`}
      paginaOpts={{ formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' }}
      piePagina='Frutera Agrosan · Documento generado electrónicamente'
    >
      <Encabezado
        logoDataUri={d.empresa.logoDataUri ?? undefined}
        tituloDocumento='Proforma de Venta de Materiales'
        numero={d.numero}
        fecha={fmt.fecha(d.fecha)}
        subtitulo={`Estado: ${d.estado}`}
      />

      <div className='doc-fila-grupos'>
        <GrupoCampos
          titulo='Exportador'
          campos={[
            { label: 'Razón social', valor: d.empresa.razonSocial },
            { label: 'RUT', valor: fmt.rut(d.empresa.rut) },
            { label: 'Dirección', valor: d.empresa.direccion ?? '—' },
          ]}
        />
        <GrupoCampos
          titulo='Cliente'
          campos={[
            { label: 'Nombre', valor: d.cliente.descripcion },
            { label: 'Razón social', valor: d.cliente.razonSocial },
            { label: 'RUT', valor: fmt.rut(d.cliente.rut) },
            { label: 'Moneda', valor: d.moneda },
            { label: 'Forma de pago', valor: d.formaPago ?? '—' },
            { label: 'Condición de pago', valor: d.condicionPago ?? '—' },
          ]}
        />
      </div>

      <TablaLineas
        titulo='Materiales'
        filas={d.lineas}
        columnas={columnasLineas}
        totales={['', '', 'Total', fmt.moneda(d.totales.total, d.moneda)]}
      />

      <BloqueTotales
        lineas={[
          { etiqueta: 'Neto', valor: fmt.moneda(d.totales.neto, d.moneda) },
          { etiqueta: 'IVA (19%)', valor: fmt.moneda(d.totales.iva, d.moneda) },
        ]}
        neto={{ etiqueta: 'Total', valor: fmt.moneda(d.totales.total, d.moneda) }}
      />

      {d.cuotas.length > 0 && (
        <TablaLineas titulo='Cuotas de Pago' filas={d.cuotas} columnas={columnasCuotas} />
      )}

      {d.observaciones && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 3 }}>Observaciones</div>
          <div style={{ fontSize: 9, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{d.observaciones}</div>
        </div>
      )}

      <PieFirma firmantes={['Frutera Agrosan', 'Cliente']} />
    </Documento>
  )
}
