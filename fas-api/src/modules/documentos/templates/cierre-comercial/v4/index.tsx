import { Documento } from '../../../ui/Documento.js'
import { fmt } from '../../../ui/formato.js'
import type { CierreComercialPdfPayload } from '../../../schemas/cierre-comercial.schema.js'
import { ocV3Css, cabeceraCorporativaCss } from '../../../ui/corporativo/estilos.js'
import { Icono, Seccion, Fila, Lineas, CabeceraCorporativa, type MarcaEstado, type NombreIcono } from '../../../ui/corporativo/componentes.js'

// v4 (2026-11-09): Calidad / Condición "hasta" pasan del encabezado a cada
// línea — se muestran como columna de la tabla de productos y salen de
// Condiciones comerciales. v3 queda congelada (regla de versionado, Etapa 4 §8).
// v3 (2026-11-08, QA/plan-cabecera-corporativa-nov2026.md): igual a v2 con la
// cabecera corporativa única (tipo de documento en grande, N° y fecha debajo,
// banda de imágenes a 22 mm como todos los documentos). v2 queda congelada.
// v2 (2026-11-06, QA/plan-cierre-pdf-v2-nov2026.md): formato corporativo
// "Sales Order" (misma línea gráfica que la OC v3). Bilingüe ES/EN. Conserva la
// firma PNG del responsable de venta sobre la línea del vendedor. v1 se
// conserva para reimpresiones (regla de versionado, Etapa 4 §4).

type Idioma = 'ES' | 'EN'

const T = {
  ES: {
    titulo: 'ORDEN DE VENTA', exportacion: 'VENTA INTERNACIONAL', nacional: 'VENTA NACIONAL',
    numero: 'N°', emision: 'Fecha de emisión', borrador: 'BORRADOR', copia: 'COPIA',
    vendedor: 'VENDEDOR / EXPORTADOR', comprador: 'COMPRADOR / CLIENTE', empresa: 'Empresa', rut: 'RUT',
    codigo: 'Código interno', direccion: 'Dirección', contacto: 'Contacto', email: 'Email', telefono: 'Teléfono',
    comerciales: 'CONDICIONES COMERCIALES', incoterm: 'Incoterm', destino: 'Destino', mercado: 'Mercado', moneda: 'Moneda',
    calidadCondicion: 'Calidad / Condición hasta',
    pago: 'CONDICIONES DE PAGO', formaPago: 'Forma de pago', condicionPago: 'Condición de pago',
    notifyConsig: 'NOTIFY / CONSIGNATARIO', notify: 'Notify', consignatario: 'Consignatario',
    detalle: 'DETALLE DE PRODUCTOS', especie: 'Especie', variedad: 'Variedad', articulo: 'Embalaje / Artículo',
    etiqueta: 'Etiqueta', categoria: 'Categoría', calibre: 'Calibre', pallets: 'Pallets', cajasPallet: 'Cajas por pallet',
    totalCajas: 'Total cajas', precio: 'Precio unit. ({m}/caja)', monto: 'Monto total ({m})',
    kgNeto: 'Peso neto por caja (kg)', kgBruto: 'Peso bruto por caja (kg)', total: 'TOTAL',
    embarque: 'EMBARQUE Y CONDICIONES DE VENTA', puertoDescarga: 'Puerto de descarga', destinoFinal: 'Destino final',
    embalaje: 'Embalaje', flete: 'Flete', seguro: 'Seguro', incluido: 'Incluido', noIncluido: 'No incluido',
    tipoVenta: 'Tipo de venta', reclamos: 'RECLAMOS', instrucciones: 'INSTRUCCIONES ADICIONALES',
    firmaAutorizada: 'Firma autorizada', cliente: 'Cliente', pagina: 'Página {p} de {t}', pie: 'Documento generado electrónicamente',
  },
  EN: {
    titulo: 'SALES ORDER', exportacion: 'INTERNATIONAL SALE', nacional: 'DOMESTIC SALE',
    numero: 'No.', emision: 'Issue Date', borrador: 'DRAFT', copia: 'COPY',
    vendedor: 'SELLER / EXPORTER', comprador: 'BUYER / CUSTOMER', empresa: 'Company', rut: 'Tax ID (RUT)',
    codigo: 'Internal Code', direccion: 'Address', contacto: 'Contact', email: 'Email', telefono: 'Phone',
    comerciales: 'COMMERCIAL TERMS', incoterm: 'Incoterm', destino: 'Destination', mercado: 'Market', moneda: 'Currency',
    calidadCondicion: 'Quality / Condition up to',
    pago: 'PAYMENT TERMS', formaPago: 'Payment Method', condicionPago: 'Payment Terms',
    notifyConsig: 'NOTIFY / CONSIGNEE', notify: 'Notify', consignatario: 'Consignee',
    detalle: 'PRODUCT DETAILS', especie: 'Species', variedad: 'Variety', articulo: 'Packaging / Article',
    etiqueta: 'Label', categoria: 'Category', calibre: 'Size / Caliber', pallets: 'Pallets', cajasPallet: 'Boxes / Pallet',
    totalCajas: 'Total Boxes', precio: 'Unit Price ({m}/box)', monto: 'Total Amount ({m})',
    kgNeto: 'Net Weight per Box (kg)', kgBruto: 'Gross Weight per Box (kg)', total: 'TOTAL',
    embarque: 'SHIPMENT AND SALES CONDITIONS', puertoDescarga: 'Port of Discharge', destinoFinal: 'Final Destination',
    embalaje: 'Packaging', flete: 'Freight', seguro: 'Insurance', incluido: 'Included', noIncluido: 'Not included',
    tipoVenta: 'Sale Type', reclamos: 'CLAIMS', instrucciones: 'ADDITIONAL INSTRUCTIONS',
    firmaAutorizada: 'Authorized Signature', cliente: 'Customer', pagina: 'Page {p} of {t}', pie: 'Document generated electronically',
  },
} as const

// Fila con ícono (condiciones comerciales / embarque).
function FilaIcono({ icono, label, valor }: { icono: NombreIcono; label: string; valor: React.ReactNode }) {
  return (
    <div className='cc2-fila-icono'>
      <Icono nombre={icono} />
      <div className='cc2-fila-icono-label'>{label}</div>
      <div>{valor}</div>
    </div>
  )
}

export function CierreComercialV4({ d, marcaAgua, marcaAguaFecha }: { d: CierreComercialPdfPayload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) {
  const idioma: Idioma = d.idioma
  const L = T[idioma]
  const n = (v: number | string | null | undefined, dec: number) => fmt.numeroIdioma(v ?? 0, dec, idioma)
  const conMoneda = (s: string) => s.replace('{m}', d.moneda)
  const marca: MarcaEstado | undefined = marcaAgua ? { tipo: marcaAgua, fecha: marcaAguaFecha } : undefined
  const fecha = fmt.fechaLarga(d.fecha, idioma)
  const destino = [d.puertoDestino, d.paisDestino].filter(Boolean).join(', ') || '—'
  const seguro = d.seguroIncluido == null ? '—' : d.seguroIncluido ? L.incluido : L.noIncluido
  const contacto = (c: CierreComercialPdfPayload['vendedor']['contacto']) => (
    <>
      <div className='oc3-espacio' />
      <Fila label={L.contacto} valor={c.nombre ?? '—'} />
      <Fila label={L.email} valor={c.email ?? '—'} />
      <Fila label={L.telefono} valor={c.telefono ?? '—'} />
    </>
  )

  return (
    <Documento
      titulo={`${L.titulo} ${d.folio}`}
      paginaOpts={{ formato: 'A4', orientacion: 'portrait', margen: '10mm 10mm 14mm' }}
      piePagina={`${d.vendedor.razonSocial} · ${L.pie}`}
      numeracion={L.pagina}
    >
      <style dangerouslySetInnerHTML={{ __html: ocV3Css + cabeceraCorporativaCss + cierreV4Css }} />

      {/* ── Cabecera: banda logo + especie (mismo alto), título y recuadro N°/fecha ── */}
      {/* Cabecera corporativa única (2026-11-08): igual que la OC — tipo de
          documento en grande, N° y fecha de emisión debajo, mismas imágenes. */}
      <CabeceraCorporativa
        logoDataUri={d.empresa.logoDataUri}
        especieImagenDataUri={d.especieImagenDataUri}
        titulo={L.titulo}
        etiquetaNumero={L.numero}
        numero={String(d.folio)}
        etiquetaFecha={L.emision}
        fecha={fecha}
        subtitulo={d.tipoVenta === 'NACIONAL' ? L.nacional : L.exportacion}
        marca={marca}
        textoBorrador={L.borrador}
        textoCopia={L.copia}
      />

      <div className='oc3-grid-2'>
        <Seccion titulo={L.vendedor} icono='edificio'>
          <Fila label={L.empresa} valor={<strong>{d.vendedor.razonSocial}</strong>} />
          <Fila label={L.rut} valor={fmt.rut(d.vendedor.rut)} />
          <Fila label={L.direccion} valor={<Lineas lineas={d.vendedor.direccionLineas} />} />
          {contacto(d.vendedor.contacto)}
        </Seccion>
        <Seccion titulo={L.comprador} icono='persona'>
          <Fila label={L.empresa} valor={<strong>{d.comprador.razonSocial}</strong>} />
          <Fila label={L.codigo} valor={d.comprador.codigo ?? '—'} />
          <Fila label={L.direccion} valor={<Lineas lineas={d.comprador.direccionLineas} />} />
          {contacto(d.comprador.contacto)}
        </Seccion>
      </div>

      <div className='oc3-grid-2'>
        <Seccion titulo={L.comerciales} icono='globo'>
          <FilaIcono icono='globo' label={L.incoterm} valor={d.clausulaVenta ?? '—'} />
          <FilaIcono icono='pin' label={L.destino} valor={destino} />
          <FilaIcono icono='monedas' label={L.mercado} valor={d.mercado ?? '—'} />
          <FilaIcono icono='monedas' label={L.moneda} valor={d.moneda} />
        </Seccion>
        <div className='cc2-columna'>
          <Seccion titulo={L.pago} icono='tarjeta'>
            <FilaIcono icono='tarjeta' label={L.formaPago} valor={d.formaPago ?? '—'} />
            <FilaIcono icono='calendario' label={L.condicionPago} valor={d.condicionPago ?? '—'} />
          </Seccion>
          <Seccion titulo={L.notifyConsig} icono='documento'>
            <Fila label={L.notify} valor={d.notify ?? '—'} />
            <Fila label={L.consignatario} valor={d.consignatario ?? '—'} />
          </Seccion>
        </div>
      </div>

      <Seccion titulo={L.detalle} icono='caja' className='oc3-seccion-tabla'>
        <table className='oc3-tabla'>
          <thead>
            <tr>
              <th>#</th><th>{L.especie}</th><th className='cc2-variedad'>{L.variedad}</th><th className='cc2-articulo'>{L.articulo}</th><th>{L.etiqueta}</th>
              <th>{L.categoria}</th><th className='cc2-calibre'>{L.calibre}</th><th className='cc2-calidad'>{L.calidadCondicion}</th><th className='num'>{L.pallets}</th>
              <th className='num'>{L.cajasPallet}</th><th className='num'>{L.totalCajas}</th>
              <th className='num'>{conMoneda(L.precio)}</th><th className='num'>{conMoneda(L.monto)}</th>
              <th className='num peso'>{L.kgNeto}</th><th className='num peso'>{L.kgBruto}</th>
            </tr>
          </thead>
          <tbody>
            {d.lineas.map((l, i) => (
              <tr key={i}>
                <td>{i + 1}</td><td>{l.especie}</td><td>{l.variedad}</td><td>{l.articulo}</td><td>{l.etiqueta ?? '—'}</td>
                <td>{l.categoria ?? '—'}</td><td>{l.calibres || '—'}</td>
                <td>{l.calidadHasta ?? '—'} / {l.condicionHasta ?? '—'}</td>
                <td className='num'>{n(l.cantidadPallets, 0)}</td><td className='num'>{n(l.cajasPorPallet, 0)}</td>
                <td className='num'>{n(l.cajas, 0)}</td><td className='num'>{n(l.precio, 2)}</td><td className='num'>{n(l.total, 2)}</td>
                <td className='num'>{n(l.kgNetoEnvase, 2)}</td><td className='num'>{n(l.kgBrutoEnvase, 2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={8} className='num'>{L.total}</td>
              <td className='num'>{n(d.totales.pallets, 0)}</td><td />
              <td className='num'>{n(d.totales.cajas, 0)}</td><td />
              <td className='num'>{n(d.totales.totalMonto, 2)}</td>
              <td className='num'>{n(d.totales.kgNeto, 2)}</td><td className='num'>{n(d.totales.kgBruto, 2)}</td>
            </tr>
          </tfoot>
        </table>
      </Seccion>

      <div className='oc3-bloque-final'>
        <Seccion titulo={L.embarque} icono='barco'>
          <div className={d.reclamos ? 'cc2-embarque cc2-embarque--reclamos' : 'cc2-embarque'}>
            <div className='cc2-embarque-col'>
              <FilaIcono icono='ancla' label={L.puertoDescarga} valor={d.puertoDestino ?? '—'} />
              <FilaIcono icono='pin' label={L.destinoFinal} valor={d.paisDestino ?? '—'} />
            </div>
            <div className='cc2-embarque-col'>
              <FilaIcono icono='caja' label={L.embalaje} valor={d.embalaje ?? '—'} />
              <FilaIcono icono='camion' label={L.flete} valor={d.tipoFlete ?? '—'} />
              <FilaIcono icono='escudo' label={L.seguro} valor={seguro} />
              <FilaIcono icono='documento' label={L.tipoVenta} valor={d.modalidadVenta ?? '—'} />
            </div>
            {d.reclamos && (
              <div className='cc2-reclamos'>
                <div className='cc2-reclamos-titulo'><Icono nombre='alerta' /> {L.reclamos}</div>
                <div className='cc2-reclamos-texto'>{d.reclamos.texto}</div>
                {d.reclamos.referencia && (
                  <div className='cc2-reclamos-ref'><Icono nombre='documento' /> <span>{d.reclamos.referencia}</span></div>
                )}
              </div>
            )}
          </div>
        </Seccion>

        <Seccion titulo={L.instrucciones} icono='comentario'>
          <div className='oc3-observaciones'>{d.observaciones?.trim() || '—'}</div>
        </Seccion>

        {/* Firmas: la firma PNG del responsable de venta se estampa sobre la
            línea del vendedor (se conserva de la v1). */}
        <div className='oc3-firmas'>
          <div className='oc3-firma'>
            <div className='oc3-firma-espacio'>
              {d.firmaResponsableDataUri && <img src={d.firmaResponsableDataUri} alt='' />}
            </div>
            <div className='oc3-firma-linea' />
            <div><strong>{d.vendedor.razonSocial}</strong></div>
            <div className='oc3-firma-detalle'>
              {L.firmaAutorizada}{d.responsableVenta ? ` · ${d.responsableVenta}` : ''}
            </div>
          </div>
          <div className='oc3-firma'>
            <div className='oc3-firma-espacio' />
            <div className='oc3-firma-linea' />
            <div><strong>{L.cliente}</strong></div>
            <div className='oc3-firma-detalle'>{L.firmaAutorizada}</div>
          </div>
        </div>
      </div>
    </Documento>
  )
}

// Estilos propios del Cierre v4 (prefijo cc2-, heredado de v2), sobre la base corporativa oc3-.
const cierreV4Css = `
  /* Compacto para que el caso típico (~5 líneas) quepa en una hoja A4. */
  .oc3-tabla { font-size: 6.6pt; }
  .oc3-tabla th.cc2-variedad { min-width: 13mm; }
  .oc3-tabla th.cc2-articulo { min-width: 19mm; }
  .oc3-tabla th.cc2-calibre { min-width: 18mm; }
  .oc3-tabla th.cc2-calidad { min-width: 14mm; }
  .oc3-tabla th.peso { min-width: 12mm; }
  .oc3-tabla td { padding: 0.8mm 0.8mm; }
  .oc3-tabla th { padding: 1.2mm 0.8mm; }
  .oc3-fila { line-height: 1.2; }
  /* Cabecera corporativa a tamaño completo (2026-11-08): se recupera el alto
     ajustando espaciados internos, no la cabecera. */
  .oc3-seccion { margin-bottom: 1.4mm; }
  .oc3-grid-2 { margin-bottom: 1.4mm; gap: 2.5mm; }
  .oc3-seccion-cuerpo { padding: 1.1mm 3.5mm; }
  .oc3-seccion-titulo { padding: 1mm 4mm; font-size: 9pt; }
  .oc3-observaciones { min-height: 0; }
  .oc3-tabla td { padding: 1mm 1mm; }
  .oc3-bloque-final { break-inside: auto; }
  .oc3-firmas { break-inside: avoid; margin-top: 0; }
  .oc3-firma-espacio { height: 9mm; }
  .cc2-columna { display: flex; flex-direction: column; gap: 2.5mm; }
  .cc2-columna > .oc3-seccion { margin-bottom: 0; }
  .cc2-fila-icono { display: grid; grid-template-columns: 5mm 30mm 1fr; gap: 2mm; align-items: center; line-height: 1.2; }
  .cc2-fila-icono .oc3-icono { width: 4.2mm; height: 4.2mm; }
  .cc2-fila-icono-label { font-weight: 700; }
  .cc2-embarque { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
  .cc2-embarque--reclamos { grid-template-columns: 1fr 1fr 1.45fr; }
  .cc2-embarque-col .cc2-fila-icono { grid-template-columns: 5mm 22mm 1fr; }
  .cc2-reclamos { background: #E3EAF4; border-radius: 2mm; padding: 1.6mm 3mm; font-size: 6.6pt; color: #2D3748; }
  .cc2-reclamos-titulo { display: flex; align-items: center; gap: 1.5mm; font-weight: 800; font-size: 9pt; color: #123E7C; margin-bottom: 1mm; }
  .cc2-reclamos-titulo .oc3-icono { width: 4.5mm; height: 4.5mm; }
  .cc2-reclamos-texto { line-height: 1.25; text-align: justify; }
  .cc2-reclamos-ref { display: flex; align-items: center; gap: 1.5mm; margin-top: 1.5mm; font-weight: 700; color: #123E7C; }
  .cc2-reclamos-ref .oc3-icono { width: 4.5mm; height: 4.5mm; }
`
