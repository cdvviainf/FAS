import { Documento } from '../../../ui/Documento.js'
import { fmt } from '../../../ui/formato.js'
import { ocV3Css } from '../../../ui/corporativo/estilos.js'
import { Icono, Seccion, Fila, Lineas, CabeceraCorporativa, type NombreIcono } from '../../../ui/corporativo/componentes.js'
import type { InstructivoEmbarquePdfPayload } from '../../../schemas/instructivo-embarque.schema.js'

// v4 (2026-11-11): formato corporativo "Shipping Instruction" (mismo sistema
// visual que la OC v3), bilingüe ES/EN.
// Hoja 1: Exportador (Entidad exportadora + contactos Documental) | Consignatario
// + Notify (+ Cliente solo en venta NACIONAL); Términos comerciales; Origen /
// Planta (con CSP) | Destino; Transporte | Documentación; Hitos | Observaciones.
// Hoja 2: Detalle de carga, Resumen (total pallets = folios distintos),
// Instrucciones especiales y firmas. Sin imagen de producto.
// RUT si la entidad es nacional, TaxId si es extranjera.
// v1–v3 quedan congeladas para reimpresiones (Etapa 4 §8).

type Idioma = 'ES' | 'EN'
type Actor = NonNullable<InstructivoEmbarquePdfPayload['consignatario']>
type Linea = InstructivoEmbarquePdfPayload['lineas'][number]

const T = {
  ES: {
    titulo: 'Instructivo de Embarque', numero: 'N°', emision: 'Fecha de emisión', pagina: 'Página {p} de {t}',
    exportador: 'EXPORTADOR', consignatario: 'CONSIGNATARIO', notify: 'NOTIFY', cliente: 'CLIENTE',
    mismoCliente: '(el mismo cliente)', rut: 'RUT', taxId: 'TaxId', direccion: 'Dirección', telefono: 'Teléfono',
    contacto: 'Contacto', email: 'Email',
    terminos: 'TÉRMINOS COMERCIALES', tipoVenta: 'Tipo de venta', ventaNacional: 'Nacional', ventaExport: 'Exportación',
    modalidad: 'Modalidad de venta', incoterm: 'Incoterm', flete: 'Flete',
    origen: 'ORIGEN / PLANTA', planta: 'Planta', csp: 'CSP', instructivo: 'Instructivo N°',
    destino: 'DESTINO', mercado: 'Mercado', pais: 'País', puertoDestino: 'Puerto de destino', tipoEmbarque: 'Tipo de embarque',
    arribo: 'Arribo estimado', puertoZarpe: 'Puerto de zarpe',
    transporte: 'TRANSPORTE', naviera: 'Naviera', nave: 'Nave', voyage: 'Voyage N°', booking: 'Booking N°',
    contenedor: 'Contenedor N°', zarpe: 'Zarpe',
    documentacion: 'DOCUMENTACIÓN', awb: 'BL / AWB', deposito: 'Depósito', cutoff: 'Cutoff', agente: 'Agente de aduana',
    embarcador: 'Embarcador', bultos: 'Tipo de bultos',
    hitos: 'HITOS EN PLANTA', cargaPlanta: 'Carga en planta', stacking: 'Stacking', a: 'a',
    observaciones: 'OBSERVACIONES',
    detalle: 'DETALLE DE CARGA', pallet: 'Pallet N°', especie: 'Especie', variedad: 'Variedad', categoria: 'Categoría',
    calibre: 'Calibre', articulo: 'Embalaje / Artículo', productor: 'Productor', cajas: 'Cajas',
    pesoNeto: 'Peso neto (kg)', pesoBruto: 'Peso bruto (kg)', total: 'TOTAL',
    resumen: 'RESUMEN', totalPallets: 'Total pallets', totalCajas: 'Total cajas', totalNeto: 'Peso neto', totalBruto: 'Peso bruto',
    instrucciones: 'INSTRUCCIONES ESPECIALES', firmaPlanta: 'Planta / Packing',
    pie: 'Documento generado electrónicamente',
    legal: 'Este instructivo de embarque es emitido electrónicamente por {e} y está sujeto a los términos y condiciones del contrato de venta.',
  },
  EN: {
    titulo: 'Shipping Instruction', numero: 'No.', emision: 'Issue Date', pagina: 'Page {p} of {t}',
    exportador: 'EXPORTER', consignatario: 'CONSIGNEE', notify: 'NOTIFY', cliente: 'BUYER',
    mismoCliente: '(same as buyer)', rut: 'RUT', taxId: 'Tax ID', direccion: 'Address', telefono: 'Phone',
    contacto: 'Contact', email: 'Email',
    terminos: 'COMMERCIAL TERMS', tipoVenta: 'Sale type', ventaNacional: 'Domestic', ventaExport: 'Export',
    modalidad: 'Sale mode', incoterm: 'Incoterm', flete: 'Freight',
    origen: 'ORIGIN / PLANT', planta: 'Plant', csp: 'CSP', instructivo: 'Instruction No.',
    destino: 'DESTINATION', mercado: 'Market', pais: 'Country', puertoDestino: 'Port of destination', tipoEmbarque: 'Type of shipment',
    arribo: 'Estimated arrival', puertoZarpe: 'Port of loading',
    transporte: 'TRANSPORTATION', naviera: 'Shipping line', nave: 'Vessel', voyage: 'Voyage number', booking: 'Booking No.',
    contenedor: 'Container No.', zarpe: 'Departure',
    documentacion: 'DOCUMENTATION', awb: 'BL / AWB', deposito: 'Depot', cutoff: 'Cutoff', agente: 'Customs broker',
    embarcador: 'Shipper', bultos: 'Packaging',
    hitos: 'PLANT SCHEDULE', cargaPlanta: 'Loading at plant', stacking: 'Stacking', a: 'to',
    observaciones: 'OBSERVATIONS',
    detalle: 'CARGO DETAIL', pallet: 'Pallet No.', especie: 'Species', variedad: 'Variety', categoria: 'Category',
    calibre: 'Size', articulo: 'Packaging / Article', productor: 'Producer', cajas: 'Boxes',
    pesoNeto: 'Net weight (kg)', pesoBruto: 'Gross weight (kg)', total: 'TOTAL',
    resumen: 'SUMMARY', totalPallets: 'Total pallets', totalCajas: 'Total boxes', totalNeto: 'Net weight', totalBruto: 'Gross weight',
    instrucciones: 'SPECIAL INSTRUCTIONS', firmaPlanta: 'Plant / Packing facility',
    pie: 'Electronically generated document',
    legal: 'This Shipping Instruction is issued electronically by {e} and is subject to the terms and conditions of the sales contract.',
  },
} as const
type Labels = (typeof T)[Idioma]

const css = `
  .ie4-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-bottom: 2.5mm; align-items: start; }
  .ie4-col > .oc3-seccion:last-child { margin-bottom: 0; }
  .ie4-grid > .oc3-seccion { margin-bottom: 0; height: 100%; }
  .ie4-sub { border-top: 1px solid #D5DCE7; margin-top: 1.5mm; padding-top: 1.5mm; }
  .ie4-sub-titulo { font-weight: 700; font-size: 8pt; letter-spacing: 0.3pt; margin-bottom: 0.8mm; }
  .ie4-terminos { display: grid; grid-template-columns: repeat(4, 1fr); }
  .ie4-hoja2 { break-before: page; }
  .ie4-resumen .oc3-fila { grid-template-columns: 1fr auto; font-size: 9pt; padding: 0.6mm 0; border-bottom: 1px solid #D5DCE7; }
  .ie4-resumen .oc3-fila:last-child { border-bottom: none; }
  .ie4-resumen .oc3-fila-valor { font-weight: 700; text-align: right; }
  .ie4-contacto { margin-top: 1.2mm; }
  .ie4-legal { font-size: 7pt; color: #4A5568; margin-top: 4mm; }
  .oc3-fila { grid-template-columns: 26mm 1fr; }
`

function textoIdFiscal(a: { rut: string | null; taxId: string | null; esNacional?: boolean }, L: Labels) {
  if (a.esNacional === false) return { label: L.taxId, valor: a.taxId ?? '—' }
  return { label: L.rut, valor: fmt.rut(a.rut) }
}

function direccionDe(a: { direccion: string | null; direccionLineas?: string[] }) {
  const lineas = a.direccionLineas && a.direccionLineas.length > 0 ? a.direccionLineas : a.direccion ? [a.direccion] : []
  return <Lineas lineas={lineas} />
}

// Contactos de tipo "Documental" de la entidad (cada uno: nombre, teléfono, email).
function Contactos({ a, L }: { a: Actor; L: Labels }) {
  const cs = a.contactosDocumentales ?? []
  if (cs.length === 0) return <Fila label={L.contacto} valor='—' />
  return (
    <>
      {cs.map((c, i) => (
        <div key={i} className={i > 0 ? 'ie4-contacto' : undefined}>
          <Fila label={L.contacto} valor={c.nombre} />
          {c.telefono && <Fila label={L.telefono} valor={c.telefono} />}
          {c.email && <Fila label={L.email} valor={c.email} />}
        </div>
      ))}
    </>
  )
}

function BloqueActor({ a, L, mostrarTelefono = true }: { a: Actor; L: Labels; mostrarTelefono?: boolean }) {
  const id = textoIdFiscal(a, L)
  return (
    <>
      <div className='oc3-razon'>{a.razonSocial}</div>
      <Fila label={id.label} valor={id.valor} />
      <Fila label={L.direccion} valor={direccionDe(a)} />
      {mostrarTelefono && a.telefono && <Fila label={L.telefono} valor={a.telefono} />}
      <div className='oc3-espacio' />
      <Contactos a={a} L={L} />
    </>
  )
}

// Notify (2026-11-11): Razón social; Dirección = dirección por defecto + país;
// contactos documentales con nombre, mail y teléfono. Sin RUT/TaxId.
function BloqueNotify({ a, L }: { a: Actor; L: Labels }) {
  const cs = a.contactosDocumentales ?? []
  const dir = a.direccionConPais ?? a.direccion
  return (
    <>
      <div className='oc3-razon'>{a.razonSocial}</div>
      <Fila label={L.direccion} valor={dir ?? '—'} />
      {cs.length === 0 ? (
        <Fila label={L.contacto} valor='—' />
      ) : (
        cs.map((c, i) => (
          <div key={i} className={i > 0 ? 'ie4-contacto' : undefined}>
            <Fila label={L.contacto} valor={c.nombre} />
            <Fila label={L.email} valor={c.email ?? '—'} />
            <Fila label={L.telefono} valor={c.telefono ?? '—'} />
          </div>
        ))
      )}
    </>
  )
}

function Termino({ icono, label, valor }: { icono: NombreIcono; label: string; valor: string }) {
  return (
    <div className='oc3-condicion'>
      <Icono nombre={icono} />
      <div><div className='oc3-condicion-label'>{label}</div><div>{valor}</div></div>
    </div>
  )
}

export function InstructivoEmbarqueV4({ d, marcaAgua, marcaAguaFecha }: { d: InstructivoEmbarquePdfPayload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) {
  const idioma: Idioma = d.idioma ?? 'ES'
  const L = T[idioma]
  const n = (v: number, dec: number) => fmt.numeroIdioma(v, dec, idioma)
  const fechaHora = (iso: string | null) => (iso ? fmt.fechaHora(iso) : '—')
  const fecha = (iso: string | null) => (iso ? fmt.fecha(iso) : '—')
  const marca = marcaAgua ? { tipo: marcaAgua, fecha: marcaAguaFecha } : undefined

  // Exportador: Entidad exportadora (resolver); payloads antiguos → empresa.
  const exportador: Actor = d.exportadorEntidad ?? {
    razonSocial: d.empresa.razonSocial, direccion: d.empresa.direccion, rut: d.empresa.rut, taxId: null,
    telefono: null, contacto: null, contactoTelefono: null, esNacional: true,
  }
  // Consignatario: el asignado en la NV; si es el propio cliente, sus datos.
  const consignatario: Actor | null = d.consignatario ?? d.clienteCompleto ?? null
  const notifies = d.notifies ?? []
  const totalNotify = notifies.length + (d.clienteEsNotify ? 1 : 0)
  const totalPallets = d.totales.folios ?? d.totales.pallets

  const cabecera = (
    <CabeceraCorporativa
      logoDataUri={d.empresa.logoDataUri}
      especieImagenDataUri={d.especieImagenDataUri ?? null}
      titulo={L.titulo}
      etiquetaNumero={L.numero}
      numero={d.codigo}
      etiquetaFecha={L.emision}
      fecha={fmt.fechaLarga(d.fecha, idioma)}
      marca={marca}
      textoBorrador='BORRADOR'
      textoCopia='COPIA'
    />
  )

  return (
    <Documento
      titulo={`${L.titulo} ${d.codigo}`}
      paginaOpts={{ formato: 'A4', orientacion: 'portrait', margen: '10mm 10mm 14mm' }}
      piePagina={`${d.empresa.razonSocial} · ${L.pie}`}
      numeracion={L.pagina}
    >
      <style dangerouslySetInnerHTML={{ __html: ocV3Css + css }} />

      {/* ───────────────────────────── HOJA 1 ───────────────────────────── */}
      {cabecera}

      <div className='ie4-grid'>
        <Seccion titulo={L.exportador}>
          <BloqueActor a={exportador} L={L} />
        </Seccion>
        <div className='ie4-col'>
          <Seccion titulo={L.consignatario}>
            {consignatario ? <BloqueActor a={consignatario} L={L} /> : <div className='oc3-razon'>{d.cliente.razonSocial}</div>}
            {/* Notify bajo el Consignatario, como en el formato de referencia. */}
            {totalNotify === 0 && (
              <div className='ie4-sub'>
                <div className='ie4-sub-titulo'>{L.notify}</div>—
              </div>
            )}
            {d.clienteEsNotify && (
              <div className='ie4-sub'>
                <div className='ie4-sub-titulo'>{totalNotify > 1 ? `${L.notify} 1` : L.notify}</div>
                {d.clienteCompleto ? <BloqueNotify a={d.clienteCompleto} L={L} /> : <div>{d.cliente.razonSocial} {L.mismoCliente}</div>}
              </div>
            )}
            {notifies.map((nt, i) => (
              <div className='ie4-sub' key={i}>
                <div className='ie4-sub-titulo'>{totalNotify > 1 ? `${L.notify} ${i + 1 + (d.clienteEsNotify ? 1 : 0)}` : L.notify}</div>
                <BloqueNotify a={nt} L={L} />
              </div>
            ))}
            {/* Cliente: solo en venta NACIONAL (en exportación no se muestra). */}
            {d.esVentaNacional && (
              <div className='ie4-sub'>
                <div className='ie4-sub-titulo'>{L.cliente}</div>
                {d.clienteCompleto ? <BloqueActor a={d.clienteCompleto} L={L} /> : <div>{d.cliente.razonSocial}</div>}
              </div>
            )}
          </Seccion>
        </div>
      </div>

      <Seccion titulo={L.terminos}>
        <div className='ie4-terminos'>
          <Termino icono='documento' label={L.tipoVenta} valor={d.esVentaNacional ? L.ventaNacional : L.ventaExport} />
          <Termino icono='aceptacion' label={L.modalidad} valor={d.modalidadVenta ?? '—'} />
          <Termino icono='caja' label={L.incoterm} valor={d.incoterm ?? '—'} />
          <Termino icono='camion' label={L.flete} valor={d.tipoFlete ?? '—'} />
        </div>
      </Seccion>

      <div className='ie4-grid'>
        <Seccion titulo={L.origen} icono='edificio'>
          <div className='oc3-razon'>{d.planta.razonSocial}</div>
          <Fila label={L.csp} valor={d.planta.csp ?? '—'} />
          <Fila label={L.direccion} valor={direccionDe(d.planta)} />
          <Fila label={L.instructivo} valor={d.numeroInstructivoPadre} />
        </Seccion>
        <Seccion titulo={L.destino} icono='pin'>
          <Fila label={L.mercado} valor={d.mercado ?? '—'} />
          <Fila label={L.pais} valor={d.paisDestino ?? '—'} />
          <Fila label={L.puertoDestino} valor={d.puertoDestino ?? '—'} />
          <Fila label={L.tipoEmbarque} valor={d.tipoEmbarque ?? '—'} />
          <Fila label={L.arribo} valor={fecha(d.fechaArribo)} />
          <Fila label={L.puertoZarpe} valor={d.puertoZarpe ?? '—'} />
        </Seccion>
      </div>

      <div className='ie4-grid'>
        <Seccion titulo={L.transporte} icono='barco'>
          <Fila label={L.naviera} valor={d.naviera ?? '—'} />
          <Fila label={L.nave} valor={d.nave ?? '—'} />
          <Fila label={L.voyage} valor={d.voyageNumber ?? '—'} />
          <Fila label={L.booking} valor={d.numeroBooking ?? '—'} />
          <Fila label={L.contenedor} valor={d.numeroContenedor ?? '—'} />
          <Fila label={L.zarpe} valor={fecha(d.fechaZarpe)} />
        </Seccion>
        <Seccion titulo={L.documentacion} icono='documento'>
          <Fila label={L.awb} valor={d.awbBl ?? '—'} />
          <Fila label={L.deposito} valor={d.deposito ?? '—'} />
          <Fila label={L.cutoff} valor={fechaHora(d.cutoffDate)} />
          <Fila label={L.agente} valor={d.agenteAduana ?? '—'} />
          <Fila label={L.embarcador} valor={d.embarcador ?? '—'} />
          <Fila label={L.bultos} valor={d.tipoBultos ?? '—'} />
        </Seccion>
      </div>

      <div className='ie4-grid'>
        <Seccion titulo={L.hitos} icono='calendario'>
          <Fila label={L.cargaPlanta} valor={fechaHora(d.fechaCargaPlanta)} />
          {d.stackingRangos.length > 0 ? (
            d.stackingRangos.map((r, i) => (
              <Fila
                key={i}
                label={d.stackingRangos.length > 1 ? `${L.stacking} ${i + 1}` : L.stacking}
                valor={`${fechaHora(r.desde)} ${L.a} ${fechaHora(r.hasta)}`}
              />
            ))
          ) : (
            <Fila label={L.stacking} valor='—' />
          )}
        </Seccion>
        <Seccion titulo={L.observaciones} icono='comentario'>
          <div className='oc3-observaciones'>{d.observaciones?.trim() || '—'}</div>
        </Seccion>
      </div>

      {/* ───────────────────────────── HOJA 2 ───────────────────────────── */}
      <div className='ie4-hoja2'>
        <Seccion titulo={L.detalle} className='oc3-seccion-tabla'>
          <table className='oc3-tabla'>
            <thead>
              <tr>
                <th>{L.pallet}</th><th>{L.especie}</th><th>{L.variedad}</th><th>{L.categoria}</th><th>{L.calibre}</th>
                <th>{L.articulo}</th><th>{L.productor}</th>
                <th className='num'>{L.cajas}</th><th className='num peso'>{L.pesoNeto}</th><th className='num peso'>{L.pesoBruto}</th>
              </tr>
            </thead>
            <tbody>
              {d.lineas.map((l: Linea, i) => (
                <tr key={i}>
                  <td>{l.numeroPallet}</td><td>{l.especie}</td><td>{l.variedad}</td><td>{l.categoria}</td><td>{l.calibre}</td>
                  <td>{l.articulo}</td><td>{l.productor}</td>
                  <td className='num'>{n(l.cajas, 0)}</td><td className='num'>{n(l.pesoNeto, 2)}</td><td className='num'>{n(l.pesoBruto, 2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7} className='num'>{L.total}</td>
                <td className='num'>{n(d.totales.cajas, 0)}</td>
                <td className='num'>{n(d.totales.pesoNeto, 2)}</td>
                <td className='num'>{n(d.totales.pesoBruto, 2)}</td>
              </tr>
            </tfoot>
          </table>
        </Seccion>

        <div className='oc3-bloque-final'>
          <div className='ie4-grid'>
            <Seccion titulo={L.instrucciones} icono='documento'>
              <div className='oc3-observaciones'>{d.observacionesGenerales?.trim() || '—'}</div>
            </Seccion>
            <Seccion titulo={L.resumen} className='ie4-resumen'>
              <Fila label={L.totalPallets} valor={n(totalPallets, 0)} />
              <Fila label={L.totalCajas} valor={n(d.totales.cajas, 0)} />
              <Fila label={L.totalNeto} valor={`${n(d.totales.pesoNeto, 2)} kg`} />
              <Fila label={L.totalBruto} valor={`${n(d.totales.pesoBruto, 2)} kg`} />
            </Seccion>
          </div>

          <div className='oc3-firmas'>
            <div className='oc3-firma'>
              <div className='oc3-firma-espacio' />
              <div className='oc3-firma-linea' />
              <div>{exportador.razonSocial}</div>
            </div>
            <div className='oc3-firma'>
              <div className='oc3-firma-espacio' />
              <div className='oc3-firma-linea' />
              <div>{L.firmaPlanta}</div>
            </div>
          </div>
          <p className='ie4-legal'>{L.legal.replace('{e}', exportador.razonSocial)}</p>
        </div>
      </div>
    </Documento>
  )
}
