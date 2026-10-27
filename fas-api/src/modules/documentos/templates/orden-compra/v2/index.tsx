import { Documento } from '../../../ui/Documento.js'
import { EncabezadoBanner } from '../../../ui/EncabezadoBanner.js'
import { GrupoCampos } from '../../../ui/GrupoCampos.js'
import { TablaLineas, type ColumnaTabla } from '../../../ui/TablaLineas.js'
import { BloqueTotales } from '../../../ui/BloqueTotales.js'
import { PieFirma } from '../../../ui/PieFirma.js'
import { fmt } from '../../../ui/formato.js'
import type { OrdenCompraPdfPayload } from '../../../schemas/orden-compra.schema.js'

// v2 (2026-10-26): encabezado tipo banner (logo + imagen de especie) y emisión
// bilingüe ES/EN. v1 se conserva intacto para reimpresiones de OC ya emitidas
// (regla de versionado, Etapa 4 §4). Los datos de catálogo (especie, variedad,
// etc.) ya vienen en el idioma del documento desde el resolver
// (descripcionExtranjera); aquí se traducen solo las etiquetas estáticas.

type Linea = OrdenCompraPdfPayload['lineas'][number]
type Idioma = 'ES' | 'EN'

interface Labels {
  titulo: string; exportador: string; proveedor: string; condiciones: string; cuotasPago: string
  observaciones: string; detalle: string; razonSocial: string; rut: string; direccion: string; contacto: string
  formaPago: string; moneda: string; incoterm: string; destino: string; cuota: string; cuotas: string
  total: string; totalNeto: string; responsable: string; especie: string; variedad: string; articulo: string
  etiqueta: string; categoria: string; calibres: string; pallets: string; cajas: string; precioCaja: string
  totalUsd: string; kgNetoEnvase: string; kgBrutoEnvase: string; kgNeto: string; kgBruto: string; kilos: string
  precioKilo: string; pie: string; fechaRef: Record<string, string>
  condicionesGranel: string; minExport: string; modalidadEntrega: string; envasesPor: string; descartePor: string
  entregaGranel: Record<string, string>; respOpc: Record<string, string>
}

const T: Record<Idioma, Labels> = {
  ES: {
    titulo: 'Orden de Compra',
    exportador: 'Exportador', proveedor: 'Proveedor', condiciones: 'Condiciones de compra',
    cuotasPago: 'Cuotas de pago', observaciones: 'Observaciones', detalle: 'Detalle',
    razonSocial: 'Razón social', rut: 'RUT', direccion: 'Dirección', contacto: 'Contacto',
    formaPago: 'Forma de pago', moneda: 'Moneda', incoterm: 'Incoterm', destino: 'Destino / Mercado',
    cuota: 'Cuota', cuotas: 'Cuotas', total: 'Total:', totalNeto: 'Total Neto USD', responsable: 'Responsable',
    especie: 'Especie', variedad: 'Variedad', articulo: 'Artículo', etiqueta: 'Etiqueta', categoria: 'Categoría',
    calibres: 'Calibres', pallets: 'Pallets', cajas: 'Cajas', precioCaja: 'Precio USD/Caja', totalUsd: 'Total USD',
    kgNetoEnvase: 'Kg Neto Envase', kgBrutoEnvase: 'Kg Bruto Envase', kgNeto: 'Kg Neto', kgBruto: 'Kg Bruto',
    kilos: 'Kilos', precioKilo: 'Precio USD/Kg',
    pie: 'Frutera Agrosan · Documento generado electrónicamente',
    fechaRef: { FACTURA: 'Factura', ZARPE: 'Zarpe', ENVIO_DOCUMENTOS: 'Envío de documentos', ARRIBO: 'Arribo' },
    condicionesGranel: 'Condiciones de granel', minExport: '% mín. de exportación', modalidadEntrega: 'Modalidad de entrega',
    envasesPor: 'Envases proporcionados por', descartePor: 'Encargado de descarte',
    entregaGranel: { PUESTA_EN_CAMPO: 'Fruta puesta en campo, con retiro por la exportadora', ENTREGADA_EN_PLANTA: 'Fruta entregada en la planta de proceso' },
    respOpc: { PRODUCTOR: 'Productor', EXPORTADORA: 'Exportadora' },
  },
  EN: {
    titulo: 'Purchase Order',
    exportador: 'Exporter', proveedor: 'Supplier', condiciones: 'Purchase terms',
    cuotasPago: 'Payment installments', observaciones: 'Remarks', detalle: 'Detail',
    razonSocial: 'Business name', rut: 'Tax ID', direccion: 'Address', contacto: 'Contact',
    formaPago: 'Payment method', moneda: 'Currency', incoterm: 'Incoterm', destino: 'Destination / Market',
    cuota: 'Installment', cuotas: 'Installments', total: 'Total:', totalNeto: 'Net Total USD', responsable: 'Responsible',
    especie: 'Species', variedad: 'Variety', articulo: 'Item', etiqueta: 'Label', categoria: 'Category',
    calibres: 'Sizes', pallets: 'Pallets', cajas: 'Boxes', precioCaja: 'USD Price/Box', totalUsd: 'Total USD',
    kgNetoEnvase: 'Net Kg/Pkg', kgBrutoEnvase: 'Gross Kg/Pkg', kgNeto: 'Net Kg', kgBruto: 'Gross Kg',
    kilos: 'Kilos', precioKilo: 'USD Price/Kg',
    pie: 'Frutera Agrosan · Electronically generated document',
    fechaRef: { FACTURA: 'Invoice', ZARPE: 'Departure', ENVIO_DOCUMENTOS: 'Document dispatch', ARRIBO: 'Arrival' },
    condicionesGranel: 'Bulk terms', minExport: 'Min. export %', modalidadEntrega: 'Delivery mode',
    envasesPor: 'Packaging provided by', descartePor: 'Discard handling by',
    entregaGranel: { PUESTA_EN_CAMPO: 'Fruit left in field, picked up by the exporter', ENTREGADA_EN_PLANTA: 'Fruit delivered at the processing plant' },
    respOpc: { PRODUCTOR: 'Producer', EXPORTADORA: 'Exporter' },
  },
}

// Etiquetas de precio/total según la moneda de la cabecera (2026-10-27): ya no
// fijo "USD". fmt.usd solo formatea el número (sin símbolo), el código de moneda
// va en el encabezado de la columna.
function etiquetasMoneda(mon: string, idioma: Idioma) {
  return {
    precioCaja: idioma === 'EN' ? `${mon} Price/Box` : `Precio ${mon}/Caja`,
    precioKilo: idioma === 'EN' ? `${mon} Price/Kg` : `Precio ${mon}/Kg`,
    total: `Total ${mon}`,
    totalNeto: idioma === 'EN' ? `Net Total ${mon}` : `Total Neto ${mon}`,
  }
}

function columnasCajas(L: Labels, mon: string, idioma: Idioma): ColumnaTabla<Linea>[] {
  const m = etiquetasMoneda(mon, idioma)
  return [
    { titulo: L.especie, render: (l) => l.especie },
    { titulo: L.variedad, render: (l) => l.variedad },
    { titulo: L.articulo, render: (l) => l.articulo },
    { titulo: L.etiqueta, render: (l) => l.etiqueta ?? '—' },
    { titulo: L.categoria, render: (l) => l.categoria ?? '—' },
    { titulo: L.calibres, render: (l) => l.calibres },
    { titulo: L.pallets, render: (l) => fmt.entero(l.cantidadPallets ?? 0), numerica: true },
    { titulo: L.cajas, render: (l) => fmt.entero(l.cajas ?? 0), numerica: true },
    { titulo: m.precioCaja, render: (l) => fmt.usd(l.precioUsdCaja ?? '0'), numerica: true },
    { titulo: m.total, render: (l) => fmt.usd(l.totalUsd), numerica: true },
    { titulo: L.kgNetoEnvase, render: (l) => fmt.kilos(l.kgNetoEnvase ?? '0'), numerica: true },
    { titulo: L.kgBrutoEnvase, render: (l) => fmt.kilos(l.kgBrutoEnvase ?? '0'), numerica: true },
    { titulo: L.kgNeto, render: (l) => fmt.kilos(l.kgNeto ?? '0'), numerica: true },
    { titulo: L.kgBruto, render: (l) => fmt.kilos(l.kgBruto ?? '0'), numerica: true },
  ]
}

function columnasGranel(L: Labels, mon: string, idioma: Idioma): ColumnaTabla<Linea>[] {
  const m = etiquetasMoneda(mon, idioma)
  return [
    { titulo: L.especie, render: (l) => l.especie },
    { titulo: L.variedad, render: (l) => l.variedad },
    { titulo: L.articulo, render: (l) => l.articulo },
    { titulo: L.kilos, render: (l) => fmt.kilos(l.cantidadKilos ?? '0'), numerica: true },
    { titulo: m.precioKilo, render: (l) => fmt.usd(l.precioUsdKilo ?? '0'), numerica: true },
    { titulo: m.total, render: (l) => fmt.usd(l.totalUsd), numerica: true },
  ]
}

// Disclaimer legal de facturación (texto legal vinculante): se mantiene en
// español en ambos idiomas por ahora.
const DISCLAIMER_FACTURACION_AGROSAN = `Facturar a:
FRUTERA AGROSAN EXPORT SPA
• El precio unitario corresponde al Incoterm indicado en el detalle conforme a Incoterms 2020.
• El proveedor será responsable por la calidad y condición de la fruta cuando cualquier deterioro o rechazo tenga su origen previo al embarque o derive de defectos de calidad o condición existentes al momento de la entrega. La aprobación del lote será hecha por el cliente final en destino y podrá acreditarse mediante informe del recibidor o surveyor independiente.
• Los gastos directamente vinculados a la fruta objeto de esta orden incurridos por FRUTERA AGROSAN EXPORT SPA y que tengan su origen en incumplimientos, defectos o hechos imputables al proveedor, así como cualquier otro costo derivado de la operación por causas atribuibles a éste, podrán incorporarse en liquidación o compensarse contra montos adeudados.
• El precio rige exclusivamente para la nave y fecha de embarque indicadas. Cualquier cambio de nave o postergación podrá implicar ajuste o renegociación del precio.
• La fecha y hora de carga a cumplir será expresada en el instructivo de embarque.
• El proveedor declara cumplir íntegramente sus obligaciones tributarias. En caso que el SII observe o rechace la devolución del crédito fiscal IVA por incumplimiento imputable al proveedor, FRUTERA AGROSAN EXPORT SPA podrá compensar el monto efectivamente rechazado, previa notificación acompañando antecedente formal del SII. El pago del IVA quedará sujeto a su efectiva recuperación.`

const DISCLAIMER_GENERICO = '* El precio unitario corresponde al Incoterm indicado conforme a Incoterms 2020. La aprobación del lote será hecha por el cliente final en destino.'

function textoCuota(c: OrdenCompraPdfPayload['cuotas'][number], L: Labels, idioma: Idioma): string {
  const valor = c.tipoValor === 'PORCENTAJE'
    ? `${c.porcentaje}%`
    : `${fmt.usd(c.valorUnitario ?? '0')} ${idioma === 'EN' ? 'per' : 'por'} ${c.unidad ?? '—'}`
  const ref = L.fechaRef[c.fechaReferencia] ?? c.fechaReferencia
  return idioma === 'EN'
    ? `${valor}, ${c.plazoDias} days from ${ref}`
    : `${valor} a ${c.plazoDias} días desde ${ref}`
}

export function OrdenCompraV2({ d, marcaAgua, marcaAguaFecha }: { d: OrdenCompraPdfPayload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) {
  const idioma: Idioma = d.idioma
  const L = T[idioma]
  const esGranel = d.modalidad === 'GRANEL'
  const columnas = esGranel ? columnasGranel(L, d.moneda, idioma) : columnasCajas(L, d.moneda, idioma)
  const totalesFila = esGranel
    ? ['', '', L.total, fmt.kilos(d.totales.kilos), '', fmt.usd(d.totales.totalUsd)]
    : [
        '', '', '', '', '', L.total,
        fmt.entero(d.totales.pallets),
        fmt.entero(d.totales.cajas),
        '',
        fmt.usd(d.totales.totalUsd),
        '',
        '',
        fmt.kilos(d.totales.kgNeto),
        fmt.kilos(d.totales.kgBruto),
      ]
  return (
    <Documento
      titulo={`${L.titulo} ${d.numero}`}
      paginaOpts={{ formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' }}
      marcaAgua={marcaAgua}
      marcaAguaFecha={marcaAguaFecha}
      piePagina={L.pie}
    >
      <EncabezadoBanner
        logoDataUri={d.empresa.logoDataUri ?? undefined}
        especieImagenDataUri={d.especieImagenDataUri ?? undefined}
        tituloDocumento={L.titulo}
        numero={d.numero}
        fecha={fmt.fecha(d.fecha)}
        subtitulo={d.responsable ?? undefined}
      />

      <div className='doc-fila-grupos'>
        <GrupoCampos
          titulo={L.exportador}
          campos={[
            { label: L.razonSocial, valor: d.empresa.razonSocial },
            { label: L.rut, valor: fmt.rut(d.empresa.rut) },
            { label: L.direccion, valor: d.empresa.direccion ?? '—' },
          ]}
        />
        <GrupoCampos
          titulo={L.proveedor}
          campos={[
            { label: L.razonSocial, valor: d.productor.razonSocial },
            { label: L.rut, valor: fmt.rut(d.productor.rut) },
            { label: L.direccion, valor: d.productor.direccion ?? '—' },
            { label: L.contacto, valor: d.productor.contacto ?? '—' },
          ]}
        />
      </div>

      <div className='doc-fila-grupos'>
        <GrupoCampos
          titulo={L.condiciones}
          campos={[
            { label: L.formaPago, valor: d.formaPago ?? '—' },
            { label: L.moneda, valor: d.moneda },
            { label: L.incoterm, valor: d.incoterm ?? '—' },
            { label: L.destino, valor: d.destinoMercado ?? '—' },
          ]}
        />
        <GrupoCampos
          titulo={L.cuotasPago}
          campos={
            d.cuotas.length > 0
              ? d.cuotas.map((c, i) => ({ label: `${L.cuota} ${i + 1}`, valor: textoCuota(c, L, idioma) }))
              : [{ label: L.cuotas, valor: '—' }]
          }
        />
      </div>

      {esGranel && (
        <GrupoCampos
          titulo={L.condicionesGranel}
          campos={[
            { label: L.minExport, valor: d.porcentajeMinExportacion != null ? `${d.porcentajeMinExportacion}%` : '—' },
            { label: L.modalidadEntrega, valor: d.modalidadEntregaGranel ? L.entregaGranel[d.modalidadEntregaGranel] : '—' },
            { label: L.envasesPor, valor: d.envasesProporcionadosPor ? L.respOpc[d.envasesProporcionadosPor] : '—' },
            { label: L.descartePor, valor: d.encargadoDescartePor ? L.respOpc[d.encargadoDescartePor] : '—' },
          ]}
        />
      )}

      {d.observaciones && (
        <GrupoCampos titulo={L.observaciones} campos={[{ label: '', valor: d.observaciones }]} />
      )}

      <TablaLineas
        titulo={L.detalle}
        filas={d.lineas}
        columnas={columnas}
        totales={totalesFila}
      />

      <BloqueTotales
        lineas={[]}
        neto={{ etiqueta: etiquetasMoneda(d.moneda, idioma).totalNeto, valor: fmt.usd(d.totales.totalUsd) }}
      />

      <PieFirma
        nota={d.empresa.codigo === 'AGROSAN' ? DISCLAIMER_FACTURACION_AGROSAN : DISCLAIMER_GENERICO}
        firmantes={[d.responsable ?? L.responsable]}
      />
    </Documento>
  )
}
