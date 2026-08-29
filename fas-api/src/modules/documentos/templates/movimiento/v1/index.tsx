import { Documento } from '../../../ui/Documento.js'
import { Encabezado } from '../../../ui/Encabezado.js'
import { GrupoCampos } from '../../../ui/GrupoCampos.js'
import { TablaLineas, type ColumnaTabla } from '../../../ui/TablaLineas.js'
import { PieFirma } from '../../../ui/PieFirma.js'
import { fmt } from '../../../ui/formato.js'
import type { MovimientoPdfPayload } from '../../../schemas/movimiento.schema.js'

type Linea = MovimientoPdfPayload['lineas'][number]

const columnas: ColumnaTabla<Linea>[] = [
  { titulo: 'Artículo', render: (l) => l.articulo },
  { titulo: 'Cantidad', render: (l) => fmt.entero(l.cantidad), numerica: true },
  { titulo: 'Precio Unitario', render: (l) => (l.precioUnitario != null ? fmt.clp(l.precioUnitario) : '—'), numerica: true },
  { titulo: 'Subtotal', render: (l) => (l.subtotal != null ? fmt.clp(l.subtotal) : '—'), numerica: true },
]

const CLASE_LABELS: Record<MovimientoPdfPayload['clase'], string> = {
  ENTRADA: 'Entrada', SALIDA: 'Salida', TRASLADO: 'Traslado',
}

// v1 — comprobante simple de Movimiento de Materiales (2026-08-29). Sin
// disclaimer legal: es un documento interno de registro, no un DTE (ver
// movimiento-guia-despacho/v1 para la variante de transporte).
export function MovimientoV1({ d, marcaAgua, marcaAguaFecha }: { d: MovimientoPdfPayload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) {
  return (
    <Documento
      titulo={`Movimiento ${d.numero}`}
      paginaOpts={{ formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' }}
      marcaAgua={marcaAgua}
      marcaAguaFecha={marcaAguaFecha}
      piePagina='Frutera Agrosan · Documento generado electrónicamente'
    >
      <Encabezado
        logoDataUri={d.empresa.logoDataUri ?? undefined}
        tituloDocumento='Comprobante de Movimiento de Materiales'
        numero={d.numero}
        fecha={fmt.fecha(d.fecha)}
        subtitulo={CLASE_LABELS[d.clase]}
      />

      <div className='doc-fila-grupos'>
        <GrupoCampos
          titulo='Empresa'
          campos={[
            { label: 'Razón social', valor: d.empresa.razonSocial },
            { label: 'RUT', valor: fmt.rut(d.empresa.rut) },
          ]}
        />
        <GrupoCampos
          titulo='Movimiento'
          campos={[
            { label: 'Tipo', valor: d.tipoMovimiento },
            { label: 'Bodega origen', valor: d.bodegaOrigen ?? '—' },
            { label: 'Bodega destino', valor: d.bodegaDestino ?? '—' },
            { label: 'Entidad', valor: d.entidad ?? '—' },
            { label: 'Guía / Referencia', valor: d.guiaReferencia ?? '—' },
          ]}
        />
      </div>

      <TablaLineas
        titulo='Detalle'
        filas={d.lineas}
        columnas={columnas}
        totales={['Total:', fmt.entero(d.totales.cantidad), '', d.totales.subtotal != null ? fmt.clp(d.totales.subtotal) : '']}
      />

      <PieFirma firmantes={['Responsable']} />
    </Documento>
  )
}
