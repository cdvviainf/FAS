// v3 (2026-11-09): copia de v2 + Tipo de documento + vencimiento estimado por
// cuota (v1/v2 congeladas, Etapa 4 §8).
// v2 (2026-11-08, QA/plan-cabecera-corporativa-nov2026.md): igual a v1 con la cabecera
// corporativa única (EncabezadoCorporativo). v1 queda congelada para reimpresiones.
import { Documento } from '../../../ui/Documento.js'
import { EncabezadoCorporativo } from '../../../ui/EncabezadoCorporativo.js'
import { GrupoCampos } from '../../../ui/GrupoCampos.js'
import { TablaLineas, type ColumnaTabla } from '../../../ui/TablaLineas.js'
import { BloqueTotales } from '../../../ui/BloqueTotales.js'
import { PieFirma } from '../../../ui/PieFirma.js'
import { fmt } from '../../../ui/formato.js'
import type { ProformaProductorPdfPayload } from '../../../schemas/proforma-productor.schema.js'

type Linea = ProformaProductorPdfPayload['lineas'][number]
type Cuota = ProformaProductorPdfPayload['cuotas'][number]

// v1 — Proforma de Servicios a Productor. Sin control de copia (Etapa 4 §8).
export function ProformaProductorV3({ d }: { d: ProformaProductorPdfPayload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) {
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
    // v3 (2026-11-09): vencimiento estimado = fecha de la Proforma + plazo (solo
    // referencia Factura); la fecha real se fija al firmar la Factura.
    { titulo: 'Vence (estimado)', render: (c) => (c.vencimientoEstimado ? fmt.fecha(c.vencimientoEstimado) : '—') },
  ]

  return (
    <Documento
      titulo={`Proforma de Servicios ${d.numero}`}
      paginaOpts={{ formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' }}
      piePagina='Frutera Agrosan · Documento generado electrónicamente'
    >
      <EncabezadoCorporativo
        logoDataUri={d.empresa.logoDataUri ?? undefined}
        tituloDocumento='Proforma de Servicios a Productor'
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
          titulo='Productor'
          campos={[
            { label: 'Nombre', valor: d.productor.descripcion },
            { label: 'Razón social', valor: d.productor.razonSocial },
            { label: 'RUT', valor: fmt.rut(d.productor.rut) },
            { label: 'Moneda', valor: d.moneda },
            { label: 'Forma de pago', valor: d.formaPago ?? '—' },
            { label: 'Condición de pago', valor: d.condicionPago ?? '—' },
            { label: 'Tipo de documento', valor: d.tipoDocumento ?? 'Factura Nacional' },
          ]}
        />
      </div>

      <TablaLineas
        titulo='Servicios'
        filas={d.lineas}
        columnas={columnasLineas}
        totales={['', '', 'Total', fmt.moneda(d.totales.total, d.moneda)]}
      />

      <BloqueTotales
        lineas={
          d.tipoDte === 34
            ? [{ etiqueta: 'Exento', valor: fmt.moneda(d.totales.exento, d.moneda) }]
            : [
                { etiqueta: 'Neto', valor: fmt.moneda(d.totales.neto, d.moneda) },
                { etiqueta: 'IVA (19%)', valor: fmt.moneda(d.totales.iva, d.moneda) },
              ]
        }
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

      <PieFirma firmantes={['Frutera Agrosan', 'Productor']} />
    </Documento>
  )
}
