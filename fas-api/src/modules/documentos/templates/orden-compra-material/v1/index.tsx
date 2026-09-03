import { Documento } from '../../../ui/Documento.js'
import { Encabezado } from '../../../ui/Encabezado.js'
import { GrupoCampos } from '../../../ui/GrupoCampos.js'
import { TablaLineas, type ColumnaTabla } from '../../../ui/TablaLineas.js'
import { BloqueTotales } from '../../../ui/BloqueTotales.js'
import { PieFirma } from '../../../ui/PieFirma.js'
import { fmt } from '../../../ui/formato.js'
import { FECHA_REFERENCIA_LABEL } from '../../../resolvers/orden-compra.resolver.js'
import type { OrdenCompraMaterialPdfPayload } from '../../../schemas/orden-compra-material.schema.js'

type Linea = OrdenCompraMaterialPdfPayload['lineas'][number]

function columnas(moneda: string): ColumnaTabla<Linea>[] {
  return [
    { titulo: 'Artículo', render: (l) => l.articulo },
    { titulo: 'Unidad', render: (l) => l.unidad },
    { titulo: 'Cantidad', render: (l) => fmt.entero(l.cantidad), numerica: true },
    { titulo: 'Precio Unitario', render: (l) => fmt.moneda(l.precioUnitario, moneda), numerica: true },
    { titulo: 'Monto', render: (l) => fmt.moneda(l.monto, moneda), numerica: true },
  ]
}

function textoCuota(c: OrdenCompraMaterialPdfPayload['cuotas'][number]): string {
  return `${c.porcentaje}% a ${c.plazoDias} días desde ${FECHA_REFERENCIA_LABEL[c.fechaReferencia]}`
}

// v1 — comprobante de Orden de Compra de Materiales (materiales.md §4.9,
// 2026-09-03). Mismo patrón que orden-compra/v1 (fruta), sin especie/
// variedad/categoría/calibre/pallet (no aplica a Materiales) ni disclaimer
// legal específico de facturación de fruta.
export function OrdenCompraMaterialV1({ d, marcaAgua, marcaAguaFecha }: { d: OrdenCompraMaterialPdfPayload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) {
  return (
    <Documento
      titulo={`Orden de Compra de Materiales ${d.numero}`}
      paginaOpts={{ formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' }}
      marcaAgua={marcaAgua}
      marcaAguaFecha={marcaAguaFecha}
      piePagina='Frutera Agrosan · Documento generado electrónicamente'
    >
      <Encabezado
        logoDataUri={d.empresa.logoDataUri ?? undefined}
        tituloDocumento='Orden de Compra de Materiales'
        numero={d.numero}
        fecha={fmt.fecha(d.fecha)}
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
          titulo='Proveedor'
          campos={[
            { label: 'Razón social', valor: d.proveedor.razonSocial },
            { label: 'RUT', valor: fmt.rut(d.proveedor.rut) },
            { label: 'Dirección', valor: d.proveedor.direccion ?? '—' },
            { label: 'Contacto', valor: d.proveedor.contacto ?? '—' },
          ]}
        />
      </div>

      <div className='doc-fila-grupos'>
        <GrupoCampos
          titulo='Condiciones de compra'
          campos={[
            { label: 'Forma de pago', valor: d.formaPago ?? '—' },
            { label: 'Moneda', valor: d.moneda },
            { label: 'Condición de pago', valor: d.condicionPago ?? '—' },
          ]}
        />
        <GrupoCampos
          titulo='Cuotas de pago'
          campos={
            d.cuotas.length > 0
              ? d.cuotas.map((c, i) => ({ label: `Cuota ${i + 1}`, valor: textoCuota(c) }))
              : [{ label: 'Cuotas', valor: '—' }]
          }
        />
      </div>

      {d.observaciones && (
        <GrupoCampos titulo='Observaciones' campos={[{ label: '', valor: d.observaciones }]} />
      )}

      <TablaLineas
        titulo='Detalle'
        filas={d.lineas}
        columnas={columnas(d.moneda)}
        totales={['', 'Total:', fmt.entero(d.totales.cantidad), '', fmt.moneda(d.totales.monto, d.moneda)]}
      />

      <BloqueTotales
        lineas={[]}
        neto={{ etiqueta: `Total ${d.moneda}`, valor: fmt.moneda(d.totales.monto, d.moneda) }}
      />

      <PieFirma firmantes={['Responsable']} />
    </Documento>
  )
}
