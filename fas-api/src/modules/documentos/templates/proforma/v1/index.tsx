import { Documento } from '../../../ui/Documento.js'
import { Encabezado } from '../../../ui/Encabezado.js'
import { GrupoCampos } from '../../../ui/GrupoCampos.js'
import { TablaLineas, type ColumnaTabla } from '../../../ui/TablaLineas.js'
import { BloqueTotales } from '../../../ui/BloqueTotales.js'
import { PieFirma } from '../../../ui/PieFirma.js'
import { fmt } from '../../../ui/formato.js'
import type { ProformaPdfPayload } from '../../../schemas/proforma.schema.js'

type Linea = ProformaPdfPayload['lineas'][number]
type Vencimiento = ProformaPdfPayload['vencimientosEstimados'][number]

// Rótulos bilingües (D — "normalmente en inglés", cobranza.md §1): el resto
// del Motor de Documentos es en español (documento interno), pero la
// Proforma se le envía al cliente en el idioma elegido al emitir.
// FAS-PROF-EXP-006 (QA ronda 1): TODO el texto visible al cliente vive acá
// (incluidas las claves crudas de FechaReferenciaPago que manda el resolver)
// — nada se traduce a mano en el resolver ni queda hardcodeado en español.
const L = {
  EN: {
    titulo: 'PROFORMA INVOICE',
    exportador: 'Exporter',
    cliente: 'Client',
    razonSocial: 'Company Name',
    rut: 'Tax ID',
    direccion: 'Address',
    numeroInstructivo: 'Shipment No.',
    condicionPago: 'Payment Terms',
    detalle: 'Detail',
    cantidad: 'Boxes',
    precioUnitario: 'Unit Price',
    monto: 'Amount',
    total: 'Total',
    vencimientos: 'Estimated Payment Schedule',
    cuota: 'Installment',
    referencia: 'Reference',
    plazo: 'Days',
    fechaEstimada: 'Estimated Date',
    pendiente: 'Pending',
    pie: 'Frutera Agrosan · Electronically generated document',
    fechaReferencia: {
      FACTURA: 'Invoice Date',
      ZARPE: 'Departure Date',
      ENVIO_DOCUMENTOS: 'Document Dispatch',
      ARRIBO: 'Arrival Date',
    },
  },
  ES: {
    titulo: 'FACTURA PROFORMA',
    exportador: 'Exportador',
    cliente: 'Cliente',
    razonSocial: 'Razón social',
    rut: 'RUT',
    direccion: 'Dirección',
    numeroInstructivo: 'N° Instructivo',
    condicionPago: 'Condición de Pago',
    detalle: 'Detalle',
    cantidad: 'Cajas',
    precioUnitario: 'Precio Unitario',
    monto: 'Monto',
    total: 'Total',
    vencimientos: 'Tabla de Vencimientos Estimada',
    cuota: 'Cuota',
    referencia: 'Referencia',
    plazo: 'Días',
    fechaEstimada: 'Fecha Estimada',
    pendiente: 'Pendiente',
    pie: 'Frutera Agrosan · Documento generado electrónicamente',
    fechaReferencia: {
      FACTURA: 'Fecha de Factura',
      ZARPE: 'Fecha de Zarpe',
      ENVIO_DOCUMENTOS: 'Envío de Documentos',
      ARRIBO: 'Fecha de Arribo',
    },
  },
} as const

export function ProformaV1({ d, marcaAgua, marcaAguaFecha }: { d: ProformaPdfPayload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) {
  const t = L[d.idioma]

  const columnasLineas: ColumnaTabla<Linea>[] = [
    { titulo: t.detalle, render: (l) => l.descripcion },
    { titulo: t.cantidad, render: (l) => fmt.entero(l.cantidadCajas), numerica: true },
    { titulo: t.precioUnitario, render: (l) => fmt.moneda(l.precioUnitario, d.moneda), numerica: true },
    { titulo: t.monto, render: (l) => fmt.moneda(l.montoLinea, d.moneda), numerica: true },
  ]

  const columnasVencimientos: ColumnaTabla<Vencimiento>[] = [
    { titulo: t.cuota, render: (v) => `#${v.numeroCuota}${v.descripcion ? ` — ${v.descripcion}` : ''}` },
    { titulo: t.referencia, render: (v) => t.fechaReferencia[v.fechaReferencia] },
    { titulo: t.plazo, render: (v) => fmt.entero(v.plazoDias), numerica: true },
    { titulo: t.fechaEstimada, render: (v) => (v.fechaEstimada ? fmt.fecha(v.fechaEstimada) : t.pendiente) },
    { titulo: t.monto, render: (v) => fmt.moneda(v.monto, d.moneda), numerica: true },
  ]

  return (
    <Documento
      titulo={`${t.titulo} ${d.codigo}`}
      paginaOpts={{ formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' }}
      marcaAgua={marcaAgua}
      marcaAguaFecha={marcaAguaFecha}
      piePagina={t.pie}
    >
      <Encabezado
        logoDataUri={d.empresa.logoDataUri ?? undefined}
        tituloDocumento={t.titulo}
        numero={d.codigo}
        fecha={fmt.fecha(d.fechaEmision)}
      />

      <div className='doc-fila-grupos'>
        <GrupoCampos
          titulo={t.exportador}
          campos={[
            { label: t.razonSocial, valor: d.empresa.razonSocial },
            { label: t.rut, valor: fmt.rut(d.empresa.rut) },
            { label: t.direccion, valor: d.empresa.direccion ?? '—' },
          ]}
        />
        <GrupoCampos
          titulo={t.cliente}
          campos={[
            { label: t.razonSocial, valor: d.cliente.razonSocial },
            { label: t.rut, valor: fmt.rut(d.cliente.rut) },
            { label: t.direccion, valor: d.cliente.direccion ?? '—' },
            { label: t.numeroInstructivo, valor: d.numeroInstructivo },
            { label: t.condicionPago, valor: d.condicionPago ?? '—' },
          ]}
        />
      </div>

      <TablaLineas
        titulo={t.detalle}
        filas={d.lineas}
        columnas={columnasLineas}
        totales={['', '', t.total, fmt.moneda(d.montoTotal, d.moneda)]}
      />

      <BloqueTotales lineas={[]} neto={{ etiqueta: t.total, valor: fmt.moneda(d.montoTotal, d.moneda) }} />

      {d.vencimientosEstimados.length > 0 && (
        <TablaLineas titulo={t.vencimientos} filas={d.vencimientosEstimados} columnas={columnasVencimientos} />
      )}

      <PieFirma firmantes={['Frutera Agrosan', t.cliente]} />
    </Documento>
  )
}
