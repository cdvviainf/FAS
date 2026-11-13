// v3 (2026-11-12): igual a v2 + Exportador = EXPORTADORA de la NV (cae a la
// empresa) y contactos documentales bajo Exportador, Consignatario y Notify.
// 2026-11-13: Exportador con el mismo bloque que el Instructivo v4 (RUT/TaxId,
// dirección en líneas, teléfono, contactos), País del cliente, DUS en
// Transporte, Condición de Pago Contado/Crédito y totales de cajas/pallets.
// v2 queda congelada para reimpresiones. Rótulos compartidos con v2.
import { Documento } from '../../../ui/Documento.js'
import { EncabezadoCorporativo } from '../../../ui/EncabezadoCorporativo.js'
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
import { ETIQUETAS_PROFORMA } from '../v2/index.js'

const L = ETIQUETAS_PROFORMA
type Contacto = { nombre: string; telefono: string | null; email: string | null }

// Contactos documentales como pares label/valor bajo la entidad.
function camposContactos(cs: Contacto[] | undefined, t: (typeof L)['ES'] | (typeof L)['EN']) {
  return (cs ?? []).flatMap((c) => [
    { label: t.contacto, valor: c.nombre },
    ...(c.email ? [{ label: t.email, valor: c.email }] : []),
    ...(c.telefono ? [{ label: t.telefono, valor: c.telefono }] : []),
  ])
}

export function ProformaV3({ d, marcaAgua, marcaAguaFecha }: { d: ProformaPdfPayload; marcaAgua?: 'BORRADOR' | 'COPIA'; marcaAguaFecha?: string }) {
  const t = L[d.idioma]
  // Exportador: la EXPORTADORA de la NV si existe; si no, la empresa emisora.
  const exp = d.exportador ?? { ...d.empresa, contactosDocumentales: [] as Contacto[] }
  const expLineas = 'direccionLineas' in exp && exp.direccionLineas && exp.direccionLineas.length > 0 ? exp.direccionLineas : exp.direccion ? [exp.direccion] : []
  const expExtranjero = 'esNacional' in exp && exp.esNacional === false
  const expContactos = exp.contactosDocumentales ?? []
  // Contado/Crédito + la descripción de la Condición de Pago (si hay).
  const formaPago = d.formaPago ? (d.formaPago === 'CONTADO' ? t.contado : t.credito) : null
  const condicionPagoTexto = [formaPago, d.condicionPago].filter(Boolean).join(' — ') || '—'
  // Título según variante: la misma plantilla sirve para la Proforma y para la
  // Factura de Exportación (DTE 110).
  const titulo = d.variante === 'FACTURA' ? t.tituloFactura : t.titulo
  const facturaConFolio = d.variante === 'FACTURA' && d.folio != null
  // Solo cuando la cláusula de venta exige Flete y/o Seguro se muestra el
  // desglose FOB; en FOB puro el documento queda idéntico a antes.
  const tieneDesgloseClausula = d.montoFlete != null || d.montoSeguro != null

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

  // Bloque "Transporte": datos de exportación del Embarque (solo datos, no
  // altera montos ni el DTE). Cada campo cae a '—' si no se cargó; los pesos se
  // muestran acá, cerca del resto de la logística. El grupo entero se omite si
  // el documento no tiene Embarque resoluble (d.transporte == null).
  const tr = d.transporte
  const guion = (v: string | null | undefined) => v ?? '—'
  // Dos columnas: la logística del contenedor hasta "Sello" en la primera,
  // puertos/fechas/comerciales/pesos en la segunda.
  const transporteCol1 = tr
    ? [
        { label: t.via, valor: guion(tr.via) },
        { label: t.nave, valor: guion(tr.nave) },
        { label: t.blAwb, valor: guion(tr.blAwb) },
        { label: t.tipoBl, valor: guion(tr.tipoBl) },
        { label: t.booking, valor: guion(tr.booking) },
        { label: t.contenedor, valor: guion(tr.contenedor) },
        { label: t.sello, valor: guion(tr.sello) },
        { label: t.dus, valor: guion(tr.dus) },
      ]
    : []
  const transporteCol2 = tr
    ? [
        { label: t.puertoEmbarque, valor: guion(tr.puertoEmbarque) },
        { label: t.puertoDestino, valor: guion(tr.puertoDestino) },
        { label: t.etd, valor: tr.etd ? fmt.fecha(tr.etd) : '—' },
        { label: t.eta, valor: tr.eta ? fmt.fecha(tr.eta) : '—' },
        { label: t.incoterm, valor: guion(tr.incoterm) },
        { label: t.modalidadVenta, valor: guion(tr.modalidadVenta) },
        { label: t.fleteTransporte, valor: guion(tr.flete) },
        ...(d.pesoNeto != null ? [{ label: t.pesoNeto, valor: fmt.kilos(d.pesoNeto) }] : []),
        ...(d.pesoBruto != null ? [{ label: t.pesoBruto, valor: fmt.kilos(d.pesoBruto) }] : []),
      ]
    : []

  return (
    <Documento
      titulo={`${titulo} ${d.codigo}`}
      paginaOpts={{ formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' }}
      piePagina={t.pie}
    >
      <EncabezadoCorporativo
        logoDataUri={d.empresa.logoDataUri ?? undefined}
        especieImagenDataUri={d.especieImagenDataUri ?? null}
        etiquetaNumero={t.numero}
        etiquetaFecha={t.emision}
        // Título = solo el tipo de documento (CAB-CORP-002). En la Factura
        // Comercial timbrada el N° es el folio SII y el código interno va de
        // subtítulo; sin folio (o en la Proforma) el N° es el código interno.
        tituloDocumento={titulo}
        numero={facturaConFolio ? String(d.folio) : d.codigo}
        subtitulo={facturaConFolio ? `${t.codigoInterno} ${d.codigo}` : undefined}
        fecha={fmt.fecha(d.fechaEmision)}
        // BORRADOR/COPIA como etiqueta bajo el folio (2026-11-07), no marca de
        // agua. Solo la Proforma tiene control de copia; la Factura Comercial
        // (variante FACTURA) nunca recibe marca.
        marca={marcaAgua ? { tipo: marcaAgua, texto: marcaAgua === 'BORRADOR' ? t.borrador : t.copia, fecha: marcaAguaFecha } : undefined}
      />

      <div className='doc-fila-grupos'>
        <GrupoCampos
          titulo={t.exportador}
          campos={[
            { label: t.razonSocial, valor: exp.razonSocial },
            expExtranjero
              ? { label: t.taxId, valor: ('taxId' in exp ? exp.taxId : null) ?? '—' }
              : { label: t.rut, valor: fmt.rut(exp.rut) },
            {
              label: t.direccion,
              valor: expLineas.length > 0 ? expLineas.map((x, i) => <div key={i}>{x}</div>) : '—',
            },
            ...(exp.telefono ? [{ label: t.telefono, valor: exp.telefono }] : []),
            // Igual que el Instructivo: "Contacto —" si no hay documentales.
            ...(expContactos.length > 0 ? camposContactos(expContactos, t) : [{ label: t.contacto, valor: '—' }]),
          ]}
        />
        <GrupoCampos
          titulo={t.cliente}
          campos={[
            { label: t.razonSocial, valor: d.cliente.razonSocial },
            { label: t.rut, valor: fmt.rut(d.cliente.rut) },
            { label: t.direccion, valor: d.cliente.direccion ?? '—' },
            { label: t.pais, valor: d.cliente.pais ?? '—' },
            { label: t.numeroInstructivo, valor: d.numeroInstructivo },
            { label: t.condicionPago, valor: condicionPagoTexto },
          ]}
        />
      </div>

      {(d.notify || d.consignatario) && (
        <div className='doc-fila-grupos'>
          {d.consignatario && (
            <GrupoCampos
              titulo={t.consignatario}
              campos={[
                { label: t.razonSocial, valor: d.consignatario.razonSocial },
                { label: t.rut, valor: fmt.rut(d.consignatario.rut) },
                { label: t.direccion, valor: d.consignatario.direccion ?? '—' },
                ...camposContactos(d.consignatario.contactosDocumentales, t),
              ]}
            />
          )}
          {d.notify && (
            <GrupoCampos
              titulo={t.notify}
              campos={[
                { label: t.razonSocial, valor: d.notify.razonSocial },
                { label: t.rut, valor: fmt.rut(d.notify.rut) },
                { label: t.direccion, valor: d.notify.direccion ?? '—' },
                ...camposContactos(d.notify.contactosDocumentales, t),
              ]}
            />
          )}
        </div>
      )}

      {tr && <GrupoCampos titulo={t.transporte} campos={transporteCol1} camposCol2={transporteCol2} />}

      <TablaLineas
        titulo={t.detalle}
        filas={d.lineas}
        columnas={columnasLineas}
        totales={['', '', tieneDesgloseClausula ? t.subtotalFob : t.total, fmt.moneda(tieneDesgloseClausula ? d.subtotalFob : d.montoTotal, d.moneda)]}
      />

      <BloqueTotales
        lineas={
          tieneDesgloseClausula
            ? [
                { etiqueta: t.subtotalFob, valor: fmt.moneda(d.subtotalFob, d.moneda) },
                ...(d.montoFlete != null ? [{ etiqueta: t.flete, valor: fmt.moneda(d.montoFlete, d.moneda) }] : []),
                ...(d.montoSeguro != null ? [{ etiqueta: t.seguro, valor: fmt.moneda(d.montoSeguro, d.moneda) }] : []),
              ]
            : []
        }
        neto={{ etiqueta: t.total, valor: fmt.moneda(d.montoTotal, d.moneda) }}
      />

      {d.montoEnPalabras && (
        <div style={{ marginTop: 6, fontSize: 9 }}>
          <span style={{ fontWeight: 700 }}>{t.montoEnPalabras}: </span>
          <span>{d.montoEnPalabras}</span>
        </div>
      )}

      {(d.totalCajas != null || d.totalPallets != null) && (
        <div style={{ marginTop: 8, fontSize: 9, display: 'flex', gap: 24, justifyContent: 'flex-end' }}>
          {d.totalCajas != null && (
            <span><span style={{ fontWeight: 700 }}>{t.totalCajas}: </span>{fmt.entero(d.totalCajas)}</span>
          )}
          {d.totalPallets != null && (
            <span><span style={{ fontWeight: 700 }}>{t.totalPallets}: </span>{fmt.entero(d.totalPallets)}</span>
          )}
        </div>
      )}

      {d.vencimientosEstimados.length > 0 && (
        <TablaLineas titulo={t.vencimientos} filas={d.vencimientosEstimados} columnas={columnasVencimientos} />
      )}

      {d.observaciones && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 3 }}>{t.observaciones}</div>
          <div style={{ fontSize: 9, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{d.observaciones}</div>
        </div>
      )}

      <PieFirma firmantes={['Frutera Agrosan', t.cliente]} />
    </Documento>
  )
}
