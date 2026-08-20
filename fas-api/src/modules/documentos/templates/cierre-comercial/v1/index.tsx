import { Documento } from '../../../ui/Documento.js'
import { Encabezado } from '../../../ui/Encabezado.js'
import { GrupoCampos } from '../../../ui/GrupoCampos.js'
import { TablaLineas, type ColumnaTabla } from '../../../ui/TablaLineas.js'
import { BloqueTotales } from '../../../ui/BloqueTotales.js'
import { PieFirma } from '../../../ui/PieFirma.js'
import { fmt } from '../../../ui/formato.js'
import { FECHA_REFERENCIA_LABEL } from '../../../resolvers/cierre-comercial.resolver.js'
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
  // Kg Envase/Neto/Bruto (feedback Christian, 2026-08-19) — mismo criterio
  // que orden-compra/v1/index.tsx. Fecha compromiso se sacó (no está en el
  // documento original).
  { titulo: 'Kg Neto Envase', render: (l) => fmt.kilos(l.kgNetoEnvase), numerica: true },
  { titulo: 'Kg Bruto Envase', render: (l) => fmt.kilos(l.kgBrutoEnvase), numerica: true },
  { titulo: 'Kg Neto', render: (l) => fmt.kilos(l.kgNeto), numerica: true },
  { titulo: 'Kg Bruto', render: (l) => fmt.kilos(l.kgBruto), numerica: true },
]

function textoCuota(c: CierreComercialPdfPayload['cuotas'][number]): string {
  const valor = c.tipoValor === 'PORCENTAJE'
    ? `${c.porcentaje}%`
    : `${fmt.usd(c.valorUnitario ?? '0')} por ${c.unidad ?? '—'}`
  return `${valor} a ${c.plazoDias} días desde ${FECHA_REFERENCIA_LABEL[c.fechaReferencia]}`
}

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
        ]}
      />
      <GrupoCampos
        titulo='Cuotas de pago'
        campos={[
          { label: 'Condición de pago', valor: d.condicionPago ?? '—' },
          ...(d.cuotas.length > 0
            ? d.cuotas.map((c, i) => ({ label: `Cuota ${i + 1}`, valor: textoCuota(c) }))
            : [{ label: 'Cuotas', valor: '—' }]),
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
          '', // Kg Bruto Envase — ídem
          fmt.kilos(d.totales.kgNeto),
          fmt.kilos(d.totales.kgBruto),
        ]}
      />

      <BloqueTotales
        lineas={[]}
        neto={{ etiqueta: 'Total Neto', valor: fmt.usd(d.totales.totalMonto) }}
      />

      <PieFirma
        nota='* El precio unitario corresponde al Incoterm indicado conforme a Incoterms 2020.'
        firmantes={['Frutera Agrosan', 'Cliente']}
      />
    </Documento>
  )
}
