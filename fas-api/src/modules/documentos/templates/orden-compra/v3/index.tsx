import { Documento } from '../../../ui/Documento.js'
import { fmt } from '../../../ui/formato.js'
import type { OrdenCompraPdfPayload } from '../../../schemas/orden-compra.schema.js'
import { ocV3Css } from '../../../ui/corporativo/estilos.js'
import { Icono, Seccion, Fila, Lineas, EtiquetaEstado as EtiquetaEstadoBase, type MarcaEstado, type NombreIcono } from '../../../ui/corporativo/componentes.js'

// v3 (2026-11-06, QA/plan-oc-pdf-v3-nov2026.md): formato corporativo
// (Docs/Orden de Compra Corporativa de Frutas.png). Hoja 1: cabecera con logo +
// imagen de especie, Comprador / Proveedor, Condiciones + Calendario de pago,
// Detalle, Facturación, Observaciones y firmas. Hoja 2 (si la empresa tiene
// cláusulas): misma cabecera compacta + Términos y Condiciones. Bilingüe ES/EN.
// v1/v2 se conservan para reimpresiones (regla de versionado, Etapa 4 §4).

type Linea = OrdenCompraPdfPayload['lineas'][number]
type Idioma = 'ES' | 'EN'

const T = {
  ES: {
    titulo: 'ORDEN DE COMPRA', numero: 'N°', emision: 'Fecha de emisión',
    comprador: 'COMPRADOR', proveedor: 'PROVEEDOR / PRODUCTOR', rut: 'RUT', direccion: 'Dirección',
    contacto: 'Contacto', telefono: 'Teléfono', email: 'Email',
    condiciones: 'CONDICIONES DE COMPRA', formaPago: 'Forma de pago', moneda: 'Moneda', incoterm: 'Incoterm',
    calendario: 'CALENDARIO DE PAGO', cuota: 'Cuota', sinCuotas: 'Sin cuotas definidas',
    granel: 'CONDICIONES DE GRANEL', minExport: '% mín. de exportación', modalidadEntrega: 'Modalidad de entrega',
    envasesPor: 'Envases proporcionados por', descartePor: 'Encargado de descarte',
    detalle: 'DETALLE DE PRODUCTOS', especie: 'Especie', variedad: 'Variedad', articulo: 'Embalaje / Artículo',
    etiqueta: 'Etiqueta', categoria: 'Categoría', calibre: 'Calibre', pallets: 'Pallets', cajas: 'Cajas',
    precioCaja: 'Precio unit. ({m}/caja)', precioKilo: 'Precio ({m}/kg)', total: 'Total ({m})', kilos: 'Kilos',
    kgNetoCaja: 'Peso neto por caja (kg)', kgBrutoCaja: 'Peso bruto por caja (kg)',
    kgNetoTotal: 'Peso neto total (kg)', kgBrutoTotal: 'Peso bruto total (kg)', totalFila: 'TOTAL',
    facturacion: 'FACTURACIÓN', facturarA: 'Facturar a:', observaciones: 'OBSERVACIONES',
    firmaAutorizada: 'Firma autorizada', proveedorFirma: 'Proveedor / Productor',
    terminos: 'TÉRMINOS Y CONDICIONES GENERALES', pagina: 'Página {p} de {t}',
    pie: 'Documento generado electrónicamente',
    borrador: 'BORRADOR', copia: 'COPIA',
    notaGenerica: '* El precio unitario corresponde al Incoterm indicado conforme a Incoterms 2020. La aprobación del lote será hecha por el cliente final en destino.',
    fechaRef: { FACTURA: 'fecha de factura', ZARPE: 'zarpe', ENVIO_DOCUMENTOS: 'envío de documentos', ARRIBO: 'arribo' } as Record<string, string>,
    entregaGranel: { PUESTA_EN_CAMPO: 'Fruta puesta en campo, con retiro por la exportadora', ENTREGADA_EN_PLANTA: 'Fruta entregada en la planta de proceso' } as Record<string, string>,
    respOpc: { PRODUCTOR: 'Productor', EXPORTADORA: 'Exportadora' } as Record<string, string>,
  },
  EN: {
    titulo: 'PURCHASE ORDER', numero: 'No.', emision: 'Issue Date',
    comprador: 'BUYER', proveedor: 'SUPPLIER / PRODUCER', rut: 'RUT', direccion: 'Address',
    contacto: 'Contact', telefono: 'Phone', email: 'Email',
    condiciones: 'PURCHASE TERMS', formaPago: 'Payment Method', moneda: 'Currency', incoterm: 'Incoterm',
    calendario: 'PAYMENT SCHEDULE', cuota: 'Installment', sinCuotas: 'No installments defined',
    granel: 'BULK TERMS', minExport: 'Min. export %', modalidadEntrega: 'Delivery mode',
    envasesPor: 'Packaging provided by', descartePor: 'Discard handling by',
    detalle: 'PRODUCT DETAILS', especie: 'Species', variedad: 'Variety', articulo: 'Packaging / Article',
    etiqueta: 'Label', categoria: 'Category', calibre: 'Size / Caliber', pallets: 'Pallets', cajas: 'Boxes',
    precioCaja: 'Unit Price ({m}/box)', precioKilo: 'Price ({m}/kg)', total: 'Total ({m})', kilos: 'Kilos',
    kgNetoCaja: 'Net Weight per Box (kg)', kgBrutoCaja: 'Gross Weight per Box (kg)',
    kgNetoTotal: 'Total Net Weight (kg)', kgBrutoTotal: 'Total Gross Weight (kg)', totalFila: 'TOTAL',
    facturacion: 'INVOICING', facturarA: 'Bill to:', observaciones: 'OBSERVATIONS',
    firmaAutorizada: 'Authorized Signature', proveedorFirma: 'Supplier / Producer',
    terminos: 'GENERAL TERMS AND CONDITIONS', pagina: 'Page {p} of {t}',
    pie: 'Electronically generated document',
    borrador: 'DRAFT', copia: 'COPY',
    notaGenerica: '* The unit price corresponds to the indicated Incoterm in accordance with Incoterms 2020. Lot approval will be made by the final customer at destination.',
    fechaRef: { FACTURA: 'invoice date', ZARPE: 'departure', ENVIO_DOCUMENTOS: 'document dispatch', ARRIBO: 'arrival' } as Record<string, string>,
    entregaGranel: { PUESTA_EN_CAMPO: 'Fruit left in field, picked up by the exporter', ENTREGADA_EN_PLANTA: 'Fruit delivered at the processing plant' } as Record<string, string>,
    respOpc: { PRODUCTOR: 'Producer', EXPORTADORA: 'Exporter' } as Record<string, string>,
  },
} as const

type Labels = (typeof T)[Idioma]

function EtiquetaEstado({ marca, L }: { marca?: MarcaEstado; L: Labels }) {
  return <EtiquetaEstadoBase marca={marca} textoBorrador={L.borrador} textoCopia={L.copia} />
}

// Cabecera completa (hoja 1) o compacta (hoja 2 y siguientes).
function Cabecera({ d, L, compacta, marca }: { d: OrdenCompraPdfPayload; L: Labels; compacta?: boolean; marca?: MarcaEstado }) {
  const fecha = fmt.fechaLarga(d.fecha, d.idioma)
  if (compacta) {
    return (
      <header className='oc3-cab-compacta'>
        <div className='oc3-cab-logo'>{d.empresa.logoDataUri && <img src={d.empresa.logoDataUri} alt='' />}</div>
        <div className='oc3-cab-compacta-info'>
          <div className='oc3-cab-compacta-titulo'>{L.titulo}</div>
          <div><strong>{L.numero} {d.numero}</strong> <span className='oc3-sep'>|</span> {fecha}</div>
          {marca && <div className='oc3-estado-fila'><EtiquetaEstado marca={marca} L={L} /></div>}
        </div>
      </header>
    )
  }
  return (
    <header className='oc3-cab'>
      {/* Banda superior: logo (izq.) e imagen de la especie (der.) con el MISMO
          alto, sin recortar ni deformar la imagen (2026-11-06). */}
      <div className='oc3-cab-banda'>
        <div className='oc3-cab-logo'>{d.empresa.logoDataUri && <img src={d.empresa.logoDataUri} alt='' />}</div>
        <div className='oc3-cab-especie'>
          {d.especieImagenDataUri && <img src={d.especieImagenDataUri} alt='' />}
        </div>
      </div>
      <div className='oc3-cab-titulo-fila'>
        <div className='oc3-cab-titulo'>{L.titulo}</div>
        <EtiquetaEstado marca={marca} L={L} />
      </div>
      <div className='oc3-cab-numero'>
        <strong>{L.numero} {d.numero}</strong> <span className='oc3-sep'>|</span> {L.emision}: {fecha}
      </div>
    </header>
  )
}

function textoCuota(c: OrdenCompraPdfPayload['cuotas'][number], L: Labels, idioma: Idioma, moneda: string): string {
  const valor = c.tipoValor === 'PORCENTAJE'
    ? `${fmt.numeroIdioma(c.porcentaje ?? '0', 0, idioma)}%`
    : `${moneda} ${fmt.numeroIdioma(c.valorUnitario ?? '0', 2, idioma)} ${idioma === 'EN' ? 'per' : 'por'} ${c.unidad ?? '—'}`
  const ref = L.fechaRef[c.fechaReferencia] ?? c.fechaReferencia
  if (c.plazoDias === 0) return idioma === 'EN' ? `${valor} at ${ref}` : `${valor} a la ${ref}`
  return idioma === 'EN' ? `${valor} ${c.plazoDias} days from ${ref}` : `${valor} a ${c.plazoDias} días desde ${ref}`
}

export function OrdenCompraV3({ d, marcaAgua, marcaAguaFecha }: { d: OrdenCompraPdfPayload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) {
  const idioma: Idioma = d.idioma
  const L = T[idioma]
  const m = d.moneda
  const n = (v: number | string | null | undefined, dec: number) => fmt.numeroIdioma(v ?? 0, dec, idioma)
  const esGranel = d.modalidad === 'GRANEL'
  const conMoneda = (s: string) => s.replace('{m}', m)
  // Borrador/Copia como etiqueta en la cabecera (no marca de agua, 2026-11-06).
  const marca: MarcaEstado | undefined = marcaAgua ? { tipo: marcaAgua, fecha: marcaAguaFecha } : undefined

  return (
    <Documento
      titulo={`${L.titulo} ${d.numero}`}
      paginaOpts={{ formato: 'A4', orientacion: 'portrait', margen: '10mm 10mm 14mm' }}
      piePagina={`${d.empresa.razonSocial} · ${L.pie}`}
      numeracion={L.pagina}
    >
      <style dangerouslySetInnerHTML={{ __html: ocV3Css }} />

      {/* ───────────────────────────── HOJA 1 ───────────────────────────── */}
      <Cabecera d={d} L={L} marca={marca} />

      <div className='oc3-grid-2'>
        <Seccion titulo={L.comprador}>
          <div className='oc3-razon'>{d.empresa.razonSocial}</div>
          <Fila label={L.rut} valor={fmt.rut(d.empresa.rut)} />
          <Fila label={L.direccion} valor={<Lineas lineas={d.empresa.direccionLineas} />} />
          <div className='oc3-espacio' />
          <Fila label={L.contacto} valor={d.comprador.nombre ?? '—'} />
          <Fila label={L.telefono} valor={d.comprador.telefono ?? '—'} />
          <Fila label={L.email} valor={d.comprador.email ?? '—'} />
        </Seccion>
        <Seccion titulo={L.proveedor}>
          <div className='oc3-razon'>{d.productor.razonSocial}</div>
          <Fila label={L.rut} valor={fmt.rut(d.productor.rut)} />
          <Fila label={L.direccion} valor={<Lineas lineas={d.productor.direccionLineas} />} />
          <div className='oc3-espacio' />
          <Fila label={L.contacto} valor={d.productor.contacto ?? '—'} />
          <Fila label={L.telefono} valor={d.productor.contactoTelefono ?? '—'} />
          <Fila label={L.email} valor={d.productor.contactoEmail ?? '—'} />
        </Seccion>
      </div>

      <div className='oc3-grid-2 oc3-grid-terminos'>
        <Seccion titulo={L.condiciones}>
          <div className='oc3-condiciones'>
            <div className='oc3-condicion'>
              <Icono nombre='documento' />
              <div><div className='oc3-condicion-label'>{L.formaPago}</div><div>{d.formaPago ?? '—'}</div></div>
            </div>
            <div className='oc3-condicion'>
              <Icono nombre='monedas' />
              <div><div className='oc3-condicion-label'>{L.moneda}</div><div>{m}</div></div>
            </div>
            <div className='oc3-condicion'>
              <Icono nombre='caja' />
              <div><div className='oc3-condicion-label'>{L.incoterm}</div><div>{d.incoterm ?? '—'}</div></div>
            </div>
          </div>
        </Seccion>
        <Seccion titulo={L.calendario}>
          <div className='oc3-calendario'>
            <Icono nombre='calendario' />
            <div className='oc3-cuotas'>
              {d.cuotas.length > 0
                ? d.cuotas.map((c, i) => (
                    <div className='oc3-cuota' key={i}>
                      <strong>{L.cuota} {i + 1}</strong>
                      <span>{textoCuota(c, L, idioma, m)}</span>
                    </div>
                  ))
                : <div>{L.sinCuotas}</div>}
            </div>
          </div>
        </Seccion>
      </div>

      {esGranel && (
        <Seccion titulo={L.granel}>
          <div className='oc3-grid-2 oc3-sin-gap'>
            <Fila label={L.minExport} valor={d.porcentajeMinExportacion != null ? `${n(d.porcentajeMinExportacion, 0)}%` : '—'} />
            <Fila label={L.modalidadEntrega} valor={d.modalidadEntregaGranel ? L.entregaGranel[d.modalidadEntregaGranel] : '—'} />
            <Fila label={L.envasesPor} valor={d.envasesProporcionadosPor ? L.respOpc[d.envasesProporcionadosPor] : '—'} />
            <Fila label={L.descartePor} valor={d.encargadoDescartePor ? L.respOpc[d.encargadoDescartePor] : '—'} />
          </div>
        </Seccion>
      )}

      <Seccion titulo={L.detalle} className='oc3-seccion-tabla'>
        <table className='oc3-tabla'>
          <thead>
            {esGranel ? (
              <tr>
                <th>#</th><th>{L.especie}</th><th>{L.variedad}</th><th>{L.articulo}</th>
                <th className='num'>{L.kilos}</th><th className='num'>{conMoneda(L.precioKilo)}</th><th className='num'>{conMoneda(L.total)}</th>
              </tr>
            ) : (
              <tr>
                <th>#</th><th>{L.especie}</th><th>{L.variedad}</th><th>{L.articulo}</th><th>{L.etiqueta}</th>
                <th>{L.categoria}</th><th>{L.calibre}</th><th className='num'>{L.pallets}</th><th className='num'>{L.cajas}</th>
                <th className='num'>{conMoneda(L.precioCaja)}</th><th className='num'>{conMoneda(L.total)}</th>
                <th className='num peso'>{L.kgNetoCaja}</th><th className='num peso'>{L.kgBrutoCaja}</th>
                <th className='num peso'>{L.kgNetoTotal}</th><th className='num peso'>{L.kgBrutoTotal}</th>
              </tr>
            )}
          </thead>
          <tbody>
            {d.lineas.map((l: Linea, i) =>
              esGranel ? (
                <tr key={i}>
                  <td>{i + 1}</td><td>{l.especie}</td><td>{l.variedad}</td><td>{l.articulo}</td>
                  <td className='num'>{n(l.cantidadKilos, 2)}</td><td className='num'>{n(l.precioUsdKilo, 2)}</td><td className='num'>{n(l.totalUsd, 2)}</td>
                </tr>
              ) : (
                <tr key={i}>
                  <td>{i + 1}</td><td>{l.especie}</td><td>{l.variedad}</td><td>{l.articulo}</td><td>{l.etiqueta ?? '—'}</td>
                  <td>{l.categoria ?? '—'}</td><td>{l.calibres || '—'}</td>
                  <td className='num'>{n(l.cantidadPallets, 0)}</td><td className='num'>{n(l.cajas, 0)}</td>
                  <td className='num'>{n(l.precioUsdCaja, 2)}</td><td className='num'>{n(l.totalUsd, 2)}</td>
                  <td className='num'>{n(l.kgNetoEnvase, 2)}</td><td className='num'>{n(l.kgBrutoEnvase, 2)}</td>
                  <td className='num'>{n(l.kgNeto, 2)}</td><td className='num'>{n(l.kgBruto, 2)}</td>
                </tr>
              ),
            )}
          </tbody>
          <tfoot>
            {esGranel ? (
              <tr>
                <td colSpan={4} className='num'>{L.totalFila}</td>
                <td className='num'>{n(d.totales.kilos, 2)}</td><td /><td className='num'>{n(d.totales.totalUsd, 2)}</td>
              </tr>
            ) : (
              <tr>
                <td colSpan={7} className='num'>{L.totalFila}</td>
                <td className='num'>{n(d.totales.pallets, 0)}</td><td className='num'>{n(d.totales.cajas, 0)}</td>
                <td /><td className='num'>{n(d.totales.totalUsd, 2)}</td>
                <td /><td />
                <td className='num'>{n(d.totales.kgNeto, 2)}</td><td className='num'>{n(d.totales.kgBruto, 2)}</td>
              </tr>
            )}
          </tfoot>
        </table>
      </Seccion>

      <div className='oc3-bloque-final'>
        <div className='oc3-grid-2'>
          <Seccion titulo={L.facturacion} icono='factura'>
            <div className='oc3-facturar'>
              <strong>{L.facturarA}</strong>
              <div>{d.empresa.razonSocial.toUpperCase()}</div>
              <Lineas lineas={d.empresa.direccionLineas} />
              <div>{L.rut}: {fmt.rut(d.empresa.rut)}</div>
            </div>
          </Seccion>
          <Seccion titulo={L.observaciones} icono='comentario'>
            <div className='oc3-observaciones'>{d.observaciones?.trim() || '—'}</div>
          </Seccion>
        </div>

        {/* OC-PDF-V3-001: sin cláusulas configuradas (sin hoja 2) se conserva la
            nota genérica de la v2, en el idioma del documento. */}
        {!d.terminos && <p className='oc3-nota-generica'>{L.notaGenerica}</p>}

        <div className='oc3-firmas'>
          <div className='oc3-firma'>
            <div className='oc3-firma-espacio'>
              {d.firmaCompradorDataUri && <img src={d.firmaCompradorDataUri} alt='' />}
            </div>
            <div className='oc3-firma-linea' />
            <div>{d.empresa.razonSocial}</div>
            <div className='oc3-firma-detalle'>{L.firmaAutorizada}</div>
          </div>
          <div className='oc3-firma'>
            <div className='oc3-firma-espacio' />
            <div className='oc3-firma-linea' />
            <div>{L.proveedorFirma}</div>
            <div className='oc3-firma-detalle'>{L.firmaAutorizada}</div>
          </div>
        </div>
      </div>

      {/* ──────────────────── HOJA 2: Términos y Condiciones ──────────────────── */}
      {d.terminos && (
        <div className='oc3-hoja-terminos'>
          <Cabecera d={d} L={L} compacta marca={marca} />
          <div className='oc3-terminos'>
            <div className='oc3-seccion-titulo'>{L.terminos}</div>
            <div className='oc3-terminos-cuerpo'>
              {d.terminos.clausulas.map((c, i) => (
                <div className='oc3-clausula' key={i}>
                  <div className='oc3-clausula-num'>{i + 1}</div>
                  <div className='oc3-clausula-icono'><Icono nombre={ICONO_CLAUSULA[c.icono]} /></div>
                  <div>
                    <div className='oc3-clausula-titulo'>{c.titulo}</div>
                    <div className='oc3-clausula-texto'>{c.texto}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {d.terminos.nota && (
            <div className='oc3-nota'>
              <Icono nombre='alerta' />
              <div>{d.terminos.nota}</div>
            </div>
          )}
        </div>
      )}
    </Documento>
  )
}

const ICONO_CLAUSULA: Record<NonNullable<OrdenCompraPdfPayload['terminos']>['clausulas'][number]['icono'], NombreIcono> = {
  CALIDAD: 'medalla',
  INOCUIDAD: 'hoja',
  COSTOS: 'monedas',
  TRIBUTARIO: 'documento',
  EMBARQUE: 'barco',
  ACEPTACION: 'aceptacion',
  DOCUMENTO: 'documento',
  INFO: 'alerta',
}
