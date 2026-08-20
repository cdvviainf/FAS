import { Documento } from '../../../ui/Documento.js'
import { Encabezado } from '../../../ui/Encabezado.js'
import { GrupoCampos } from '../../../ui/GrupoCampos.js'
import { TablaLineas, type ColumnaTabla } from '../../../ui/TablaLineas.js'
import { BloqueTotales } from '../../../ui/BloqueTotales.js'
import { PieFirma } from '../../../ui/PieFirma.js'
import { fmt } from '../../../ui/formato.js'
import { FECHA_REFERENCIA_LABEL } from '../../../resolvers/orden-compra.resolver.js'
import type { OrdenCompraPdfPayload } from '../../../schemas/orden-compra.schema.js'

type Linea = OrdenCompraPdfPayload['lineas'][number]

const columnas: ColumnaTabla<Linea>[] = [
  { titulo: 'Especie', render: (l) => l.especie },
  { titulo: 'Variedad', render: (l) => l.variedad },
  { titulo: 'Artículo', render: (l) => l.articulo },
  { titulo: 'Etiqueta', render: (l) => l.etiqueta ?? '—' },
  { titulo: 'Categoría', render: (l) => l.categoria },
  { titulo: 'Calibres', render: (l) => l.calibres },
  { titulo: 'Pallets', render: (l) => fmt.entero(l.cantidadPallets), numerica: true },
  { titulo: 'Cajas', render: (l) => fmt.entero(l.cajas), numerica: true },
  { titulo: 'Precio USD/Caja', render: (l) => fmt.usd(l.precioUsdCaja), numerica: true },
  { titulo: 'Total USD', render: (l) => fmt.usd(l.totalUsd), numerica: true },
  // Kg Envase (feedback Christian, 2026-08-19): dato de catálogo, distinto
  // del Kg Neto/Bruto de más abajo (total de la línea = envase × cajas).
  { titulo: 'Kg Neto Envase', render: (l) => fmt.kilos(l.kgNetoEnvase), numerica: true },
  { titulo: 'Kg Bruto Envase', render: (l) => fmt.kilos(l.kgBrutoEnvase), numerica: true },
  { titulo: 'Kg Neto', render: (l) => fmt.kilos(l.kgNeto), numerica: true },
  { titulo: 'Kg Bruto', render: (l) => fmt.kilos(l.kgBruto), numerica: true },
]

// Disclaimer legal de facturación (feedback Christian, 2026-08-19/20) —
// texto de la OC original en papel. Solo Agrosan por ahora (empresa.codigo
// === 'AGROSAN'): "FRUTERA AGROSAN EXPORT SPA" es una razón social de
// facturación específica, distinta de Empresa.razonSocial ("Frutera Agrosan
// SpA") — AGDry no tiene definido su propio texto todavía, así que su OC
// sigue con el disclaimer genérico de una línea (ver DISCLAIMER_GENERICO).
const DISCLAIMER_FACTURACION_AGROSAN = `Facturar a:
FRUTERA AGROSAN EXPORT SPA
• El precio unitario corresponde al Incoterm indicado en el detalle conforme a Incoterms 2020.
• El proveedor será responsable por la calidad y condición de la fruta cuando cualquier deterioro o rechazo tenga su origen previo al embarque o derive de defectos de calidad o condición existentes al momento de la entrega. La aprobación del lote será hecha por el cliente final en destino y podrá acreditarse mediante informe del recibidor o surveyor independiente.
• Los gastos directamente vinculados a la fruta objeto de esta orden incurridos por FRUTERA AGROSAN EXPORT SPA y que tengan su origen en incumplimientos, defectos o hechos imputables al proveedor, así como cualquier otro costo derivado de la operación por causas atribuibles a éste, podrán incorporarse en liquidación o compensarse contra montos adeudados.
• El precio rige exclusivamente para la nave y fecha de embarque indicadas. Cualquier cambio de nave o postergación podrá implicar ajuste o renegociación del precio.
• La fecha y hora de carga a cumplir será expresada en el instructivo de embarque.
• El proveedor declara cumplir íntegramente sus obligaciones tributarias. En caso que el SII observe o rechace la devolución del crédito fiscal IVA por incumplimiento imputable al proveedor, FRUTERA AGROSAN EXPORT SPA podrá compensar el monto efectivamente rechazado, previa notificación acompañando antecedente formal del SII. El pago del IVA quedará sujeto a su efectiva recuperación.`

const DISCLAIMER_GENERICO = '* El precio unitario corresponde al Incoterm indicado conforme a Incoterms 2020. La aprobación del lote será hecha por el cliente final en destino.'

function textoCuota(c: OrdenCompraPdfPayload['cuotas'][number]): string {
  const valor = c.tipoValor === 'PORCENTAJE'
    ? `${c.porcentaje}%`
    : `${fmt.usd(c.valorUnitario ?? '0')} por ${c.unidad ?? '—'}`
  return `${valor} a ${c.plazoDias} días desde ${FECHA_REFERENCIA_LABEL[c.fechaReferencia]}`
}

// v1 — piloto de la Etapa 4 (Docs/agrosan_etapa4_motor_documentos.md §9,
// Sprint A). Layout de referencia: Docs/AGROSAN 002 -OC5.pdf (sistema
// legado). Simplificaciones deliberadas frente al legado, documentadas para
// la revisión de Marcos:
// - Sin IVA/Total Bruto: el modelo actual de OrdenCompra no registra tasa de
//   impuesto — solo se muestra el Total Neto USD calculado de las líneas.
// - "Calibre Inicio/Fin" (rango) reemplazado por la lista real de calibres
//   de la línea (compras.md §4.3, supersesión 2026-08-15: la OC ya no
//   persiste un rango, persiste una lista puntual).
// - "Plazo Pago 1/2/3" (3 casilleros fijos) reemplazado por la lista real de
//   cuotas de OrdenCompra.cuotasPago (N cuotas, no acotado a 3).
// - Logo: viene de Empresa.logo (mantenedor de Empresas, pestaña Logo — ver
//   documentos.repository.ts#logoDataUri). Sin logo subido, el Encabezado
//   simplemente no lo pinta (Etapa 4 §12, ya no pendiente).
export function OrdenCompraV1({ d, marcaAgua, marcaAguaFecha }: { d: OrdenCompraPdfPayload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) {
  return (
    <Documento
      titulo={`Orden de Compra ${d.numero}`}
      paginaOpts={{ formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' }}
      marcaAgua={marcaAgua}
      marcaAguaFecha={marcaAguaFecha}
      piePagina='Frutera Agrosan · Documento generado electrónicamente'
    >
      <Encabezado
        logoDataUri={d.empresa.logoDataUri ?? undefined}
        tituloDocumento='Orden de Compra / Purchase Order'
        numero={d.numero}
        fecha={fmt.fecha(d.fecha)}
        subtitulo={d.responsable ?? undefined}
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
          titulo='Proveedor'
          campos={[
            { label: 'Razón social', valor: d.productor.razonSocial },
            { label: 'RUT', valor: fmt.rut(d.productor.rut) },
            { label: 'Dirección', valor: d.productor.direccion ?? '—' },
            { label: 'Contacto', valor: d.productor.contacto ?? '—' },
          ]}
        />
      </div>

      <div className='doc-fila-grupos'>
        <GrupoCampos
          titulo='Condiciones de compra'
          campos={[
            { label: 'Forma de pago', valor: d.formaPago ?? '—' },
            { label: 'Moneda', valor: d.moneda },
            { label: 'Incoterm', valor: d.incoterm ?? '—' },
            { label: 'Destino / Mercado', valor: d.destinoMercado ?? '—' },
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
        columnas={columnas}
        totales={[
          '', '', '', '', '', 'Total:',
          fmt.entero(d.totales.pallets),
          fmt.entero(d.totales.cajas),
          '',
          fmt.usd(d.totales.totalUsd),
          '', // Kg Neto Envase — dato de catálogo, no se totaliza
          '', // Kg Bruto Envase — ídem
          fmt.kilos(d.totales.kgNeto),
          fmt.kilos(d.totales.kgBruto),
        ]}
      />

      <BloqueTotales
        lineas={[]}
        neto={{ etiqueta: 'Total Neto USD', valor: fmt.usd(d.totales.totalUsd) }}
      />

      <PieFirma
        nota={d.empresa.codigo === 'AGROSAN' ? DISCLAIMER_FACTURACION_AGROSAN : DISCLAIMER_GENERICO}
        firmantes={[d.responsable ?? 'Responsable']}
      />
    </Documento>
  )
}
