import { Documento } from '../../../ui/Documento.js'
import { Encabezado } from '../../../ui/Encabezado.js'
import { GrupoCampos } from '../../../ui/GrupoCampos.js'
import { TablaLineas, type ColumnaTabla } from '../../../ui/TablaLineas.js'
import { BloqueTotales } from '../../../ui/BloqueTotales.js'
import { PieFirma } from '../../../ui/PieFirma.js'
import { fmt } from '../../../ui/formato.js'
import type { CierreComercialPdfPayload } from '../../../schemas/cierre-comercial.schema.js'

type Linea = CierreComercialPdfPayload['lineas'][number]

const columnas: ColumnaTabla<Linea>[] = [
  { titulo: 'Especie', render: (l) => l.especie },
  { titulo: 'Variedad', render: (l) => l.variedad },
  { titulo: 'Artículo', render: (l) => l.articulo },
  { titulo: 'Etiqueta', render: (l) => l.etiqueta ?? '—' },
  { titulo: 'Categoría', render: (l) => l.categoria ?? '—' },
  { titulo: 'Calibres', render: (l) => l.calibres },
  { titulo: 'Pallets', render: (l) => fmt.entero(l.cantidadPallets), numerica: true },
  { titulo: 'Cajas', render: (l) => fmt.entero(l.cajas), numerica: true },
  { titulo: 'Precio', render: (l) => fmt.usd(l.precio), numerica: true },
  { titulo: 'Total', render: (l) => fmt.usd(l.total), numerica: true },
  // Solo Kg Neto por envase (2026-11-05): se eliminaron Kg Bruto Envase
  // (unitario bruto) y los kilos totales Neto/Bruto, a pedido del cliente.
  { titulo: 'Kg Neto Envase', render: (l) => fmt.kilos(l.kgNetoEnvase), numerica: true },
]

// v1 — CON control de copia (Etapa 4 §8): recibe marcaAgua/marcaAguaFecha
// como la Orden de Compra. Layout análogo al de orden-compra/v1, adaptado a
// los campos propios de NotaVenta (cliente/consignatario/embarque/incoterm
// en vez de forma de pago del productor).
export function CierreComercialV1({ d, marcaAgua, marcaAguaFecha }: { d: CierreComercialPdfPayload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) {
  return (
    <Documento
      titulo={`Cierre Comercial ${d.folio}`}
      paginaOpts={{ formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' }}
      marcaAgua={marcaAgua}
      marcaAguaFecha={marcaAguaFecha}
      piePagina='Frutera Agrosan · Documento generado electrónicamente'
    >
      <Encabezado
        logoDataUri={d.empresa.logoDataUri ?? undefined}
        tituloDocumento='Cierre Comercial / Sales Contract'
        numero={d.folio}
        fecha={fmt.fecha(d.fecha)}
        subtitulo={d.responsableVenta ? `Responsable de venta: ${d.responsableVenta}` : undefined}
      />

      <div className='doc-fila-grupos'>
        <GrupoCampos
          titulo='Exportador'
          campos={[
            { label: 'Razón social', valor: d.exportador.razonSocial },
            { label: 'RUT', valor: fmt.rut(d.exportador.rut) },
            { label: 'Dirección', valor: d.exportador.direccion ?? '—' },
            { label: 'Responsable de venta', valor: d.responsableVenta ?? '—' },
          ]}
        />
        <GrupoCampos
          titulo='Cliente'
          campos={[
            { label: 'Razón social', valor: d.cliente.razonSocial },
            { label: 'RUT', valor: fmt.rut(d.cliente.rut) },
            { label: 'Dirección', valor: d.cliente.direccion ?? '—' },
            { label: 'Contacto comprador', valor: d.compradorContacto ?? '—' },
            { label: 'Notify', valor: d.notify ?? '—' },
            { label: 'Consignatario', valor: d.consignatario ?? '—' },
          ]}
        />
      </div>

      {/* Ancho completo, cada una en su propia fila (feedback Christian,
          2026-08-19) — antes compartían `.doc-fila-grupos` a media página y
          Condiciones de venta (9 campos) quedaba muy apretada. Dirección de
          destino se sacó (no está en el documento original). */}
      <GrupoCampos
        titulo='Condiciones de venta'
        campos={[
          { label: 'Tipo de embarque', valor: d.tipoEmbarque ?? '—' },
          { label: 'Mercado', valor: d.mercado ?? '—' },
          { label: 'País destino', valor: d.paisDestino ?? '—' },
          { label: 'Puerto destino', valor: d.puertoDestino ?? '—' },
          { label: 'Modalidad de venta', valor: d.modalidadVenta ?? '—' },
          { label: 'Incoterm', valor: d.clausulaVenta ?? '—' },
          { label: 'Flete', valor: d.tipoFlete ?? '—' },
          { label: 'Moneda', valor: d.moneda },
          { label: 'Condición de pago', valor: d.condicionPago ?? '—' },
          { label: 'Calidad hasta', valor: d.calidadHasta ?? 'Sin restricción' },
          { label: 'Condición hasta', valor: d.condicionHasta ?? 'Sin restricción' },
        ]}
      />

      {d.observaciones && (
        <GrupoCampos titulo='Observaciones' campos={[{ label: '', valor: d.observaciones }]} />
      )}

      <TablaLineas
        titulo='Detalle'
        filas={d.lineas}
        columnas={columnas}
        totales={[
          '', '', '', '', '', 'Total:',
          fmt.entero(d.totales.pallets),
          fmt.entero(d.totales.cajas),
          '',
          fmt.usd(d.totales.totalMonto),
          '', // Kg Neto Envase — dato de catálogo, no se totaliza
        ]}
      />

      <BloqueTotales
        lineas={[]}
        neto={{ etiqueta: 'Total Neto', valor: fmt.usd(d.totales.totalMonto) }}
      />

      <PieFirma
        nota='* El precio unitario corresponde al Incoterm indicado conforme a Incoterms 2020.'
        firmantes={[
          // Firma PNG del responsable de venta sobre la línea (2026-11-05).
          { nombre: 'Frutera Agrosan', imagenDataUri: d.firmaResponsableDataUri, detalle: d.responsableVenta },
          'Cliente',
        ]}
      />
    </Documento>
  )
}
