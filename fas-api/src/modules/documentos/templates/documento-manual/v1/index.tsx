import { Documento } from '../../../ui/Documento.js'
import { Encabezado } from '../../../ui/Encabezado.js'
import { GrupoCampos } from '../../../ui/GrupoCampos.js'
import { TablaLineas, type ColumnaTabla } from '../../../ui/TablaLineas.js'
import { BloqueTotales } from '../../../ui/BloqueTotales.js'
import { PieFirma } from '../../../ui/PieFirma.js'
import { fmt } from '../../../ui/formato.js'
import type { DocumentoManualPdfPayload } from '../../../schemas/documento-manual.schema.js'

type Linea = DocumentoManualPdfPayload['lineas'][number]
type Referencia = DocumentoManualPdfPayload['referencias'][number]

// v1 — Documento Manual (Generador DTE). Previsualización de borrador, sin control
// de copia. Las secciones Transporte (guía) y Referencias (NC/ND) se muestran solo
// cuando aplican.
export function DocumentoManualV1({ d }: { d: DocumentoManualPdfPayload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) {
  const columnasLineas: ColumnaTabla<Linea>[] = [
    { titulo: 'Detalle', render: (l) => l.descripcion },
    { titulo: 'Cantidad', render: (l) => fmt.entero(l.cantidad), numerica: true },
    { titulo: 'Precio Unit.', render: (l) => fmt.moneda(l.precioUnitario, d.moneda), numerica: true },
    { titulo: 'Monto', render: (l) => fmt.moneda(l.monto, d.moneda), numerica: true },
  ]

  const columnasReferencias: ColumnaTabla<Referencia>[] = [
    { titulo: 'Tipo Doc.', render: (r) => r.tipoDocRef },
    { titulo: 'Folio', render: (r) => r.folioRef },
    { titulo: 'Fecha', render: (r) => fmt.fecha(r.fechaRef) },
    { titulo: 'Motivo', render: (r) => r.codRef ?? '—' },
    { titulo: 'Razón', render: (r) => r.razonRef ?? '—' },
  ]

  return (
    <Documento
      titulo={`${d.claseLabel} ${d.codigo}`}
      paginaOpts={{ formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' }}
      piePagina='Frutera Agrosan · Documento generado electrónicamente'
    >
      <Encabezado
        logoDataUri={d.empresa.logoDataUri ?? undefined}
        tituloDocumento={d.tituloDocumento}
        numero={d.codigo}
        fecha={fmt.fecha(d.fecha)}
        subtitulo={`Estado: ${d.estado}`}
      />

      <div className='doc-fila-grupos'>
        <GrupoCampos
          titulo='Emisor'
          campos={[
            { label: 'Razón social', valor: d.empresa.razonSocial },
            { label: 'RUT', valor: fmt.rut(d.empresa.rut) },
            { label: 'Dirección', valor: d.empresa.direccion ?? '—' },
          ]}
        />
        <GrupoCampos
          titulo='Receptor'
          campos={[
            { label: 'Nombre', valor: d.receptor.descripcion },
            { label: 'Razón social', valor: d.receptor.razonSocial },
            { label: 'RUT', valor: fmt.rut(d.receptor.rut) },
            { label: 'Moneda', valor: d.moneda },
            { label: 'Condición de pago', valor: d.condicionPago ?? '—' },
          ]}
        />
      </div>

      {d.transporte && (
        <GrupoCampos
          titulo='Transporte'
          campos={[
            { label: 'Tipo de traslado', valor: d.transporte.indTraslado },
            { label: 'Transportista', valor: d.transporte.transportista ?? '—' },
            { label: 'Chofer', valor: d.transporte.chofer ?? '—' },
            { label: 'RUT chofer', valor: d.transporte.choferRut ?? '—' },
            { label: 'Patente camión', valor: d.transporte.patenteCamion ?? '—' },
            { label: 'Patente remolque', valor: d.transporte.patenteRemolque ?? '—' },
            { label: 'Origen', valor: d.transporte.origen ?? '—' },
            { label: 'Destino', valor: d.transporte.destino ?? '—' },
          ]}
        />
      )}

      {d.referencias.length > 0 && (
        <TablaLineas titulo='Documentos de referencia' filas={d.referencias} columnas={columnasReferencias} />
      )}

      <TablaLineas
        titulo='Detalle'
        filas={d.lineas}
        columnas={columnasLineas}
        totales={['', '', '', 'Total', fmt.moneda(d.totales.total, d.moneda)]}
      />

      <BloqueTotales
        lineas={[
          { etiqueta: 'Neto', valor: fmt.moneda(d.totales.neto, d.moneda) },
          { etiqueta: 'Exento', valor: fmt.moneda(d.totales.exento, d.moneda) },
          { etiqueta: 'IVA (19%)', valor: fmt.moneda(d.totales.iva, d.moneda) },
        ]}
        neto={{ etiqueta: 'Total', valor: fmt.moneda(d.totales.total, d.moneda) }}
      />

      {d.observaciones && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 3 }}>Observaciones</div>
          <div style={{ fontSize: 9, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{d.observaciones}</div>
        </div>
      )}

      <PieFirma firmantes={['Frutera Agrosan', d.receptor.descripcion]} />
    </Documento>
  )
}
