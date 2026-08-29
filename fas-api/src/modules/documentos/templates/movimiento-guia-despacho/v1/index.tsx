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
]

// Disclaimer obligatorio (Docs/agrosan_etapa4_motor_documentos.md §7): la
// Guía de Despacho real es un DTE regulado por el SII (timbre PDF417, folio
// CAF) — esto NO lo es. Es un documento interno para acompañar el traslado
// físico mientras no exista un proveedor DTE integrado (fas-api/src/modules/
// finanzas/ no existe todavía).
const DISCLAIMER_GUIA_DESPACHO =
  'DOCUMENTO INTERNO — NO VÁLIDO COMO DOCUMENTO TRIBUTARIO ELECTRÓNICO ANTE EL SII. Uso exclusivo para control interno del traslado de materiales.'

// v1 (2026-08-29) — solo se genera para movimientos CONFIRMADO cuyo tipo
// exige datos de transporte (emiteDTE); el gate vive en el resolver
// (resolverMovimientoGuiaDespacho), no acá.
export function MovimientoGuiaDespachoV1({ d, marcaAgua, marcaAguaFecha }: { d: MovimientoPdfPayload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) {
  return (
    <Documento
      titulo={`Guía de Despacho (interna) ${d.numero}`}
      paginaOpts={{ formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' }}
      marcaAgua={marcaAgua}
      marcaAguaFecha={marcaAguaFecha}
      piePagina='Frutera Agrosan · Documento generado electrónicamente'
    >
      <Encabezado
        logoDataUri={d.empresa.logoDataUri ?? undefined}
        tituloDocumento='Guía de Despacho (documento interno)'
        numero={d.numero}
        fecha={fmt.fecha(d.fecha)}
      />

      <div className='doc-fila-grupos'>
        <GrupoCampos
          titulo='Origen / Destino'
          campos={[
            { label: 'Bodega origen', valor: d.bodegaOrigen ?? '—' },
            { label: 'Bodega destino', valor: d.bodegaDestino ?? '—' },
            { label: 'Entidad', valor: d.entidad ?? '—' },
            { label: 'Guía / Referencia', valor: d.guiaReferencia ?? '—' },
          ]}
        />
        <GrupoCampos
          titulo='Transporte'
          campos={[
            { label: 'Transportista', valor: d.transporte.transportista ?? '—' },
            { label: 'Chofer', valor: d.transporte.choferNombre ?? '—' },
            { label: 'RUT chofer', valor: fmt.rut(d.transporte.choferRut) },
            { label: 'Placa camión', valor: d.transporte.placaCamion ?? '—' },
            { label: 'Placa remolque', valor: d.transporte.placaRemolque ?? '—' },
            { label: 'Hora salida', valor: d.transporte.horaSalida ? fmt.fechaHora(d.transporte.horaSalida) : '—' },
            { label: 'Hora estimada llegada', valor: d.transporte.horaEstimadaLlegada ? fmt.fechaHora(d.transporte.horaEstimadaLlegada) : '—' },
          ]}
        />
      </div>

      <TablaLineas titulo='Detalle' filas={d.lineas} columnas={columnas} />

      <PieFirma nota={DISCLAIMER_GUIA_DESPACHO} firmantes={['Chofer', 'Recibe']} />
    </Documento>
  )
}
