// Proforma de Exportación en Excel (2026-11-12): mismo contenido que el PDF
// (ProformaV2) a partir del MISMO payload validado — exportador/cliente,
// consignatario/notify, transporte, detalle, totales (desglose FOB/flete/
// seguro), monto en palabras, vencimientos y observaciones. Montos y fechas van
// como valores numéricos/fecha de Excel (no texto) para que se puedan operar.
import ExcelJS from 'exceljs'
import type { ProformaPdfPayload } from '../schemas/proforma.schema.js'
import { ETIQUETAS_PROFORMA } from '../templates/proforma/v2/index.js'

const COLOR_TITULO = 'FF1F3A5F'
const COLOR_SECCION = 'FFE8EEF5'
const FMT_MONTO = '#,##0.00'
const FMT_ENTERO = '#,##0'
const FMT_FECHA = 'dd-mm-yyyy'

// Fecha pura del payload (YYYY-MM-DD…) → Date UTC sin corrimiento de día.
function fecha(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!))
}

export async function generarProformaExcel(d: ProformaPdfPayload): Promise<Buffer> {
  const t = ETIQUETAS_PROFORMA[d.idioma]
  const titulo = d.variante === 'FACTURA' ? t.tituloFactura : t.titulo
  const tieneDesglose = d.montoFlete != null || d.montoSeguro != null
  const exp = d.exportador ?? { ...d.empresa, contactosDocumentales: [] }
  const expLineas = 'direccionLineas' in exp && exp.direccionLineas && exp.direccionLineas.length > 0 ? exp.direccionLineas : null
  const expExtranjero = 'esNacional' in exp && exp.esNacional === false
  const formaPago = d.formaPago ? (d.formaPago === 'CONTADO' ? t.contado : t.credito) : null
  const condicionPagoTexto = [formaPago, d.condicionPago].filter(Boolean).join(' — ') || null
  type Par = [string, string | number | Date | null]
  // Contactos documentales bajo cada entidad (2026-11-12).
  const contactos = (cs: { nombre: string; telefono: string | null; email: string | null }[] | undefined): Par[] =>
    (cs ?? []).flatMap((c) => [
      [t.contacto, c.nombre] as Par,
      ...(c.email ? [[t.email, c.email] as Par] : []),
      ...(c.telefono ? [[t.telefono, c.telefono] as Par] : []),
    ])

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(d.variante === 'FACTURA' ? 'Invoice' : 'Proforma', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  // 5 columnas: A-B pares etiqueta/valor (izquierda), D-E (derecha); en las
  // tablas se usan todas.
  ws.columns = [{ width: 30 }, { width: 34 }, { width: 10 }, { width: 24 }, { width: 22 }]

  const seccion = (texto: string) => {
    const r = ws.addRow([texto])
    ws.mergeCells(r.number, 1, r.number, 5)
    r.getCell(1).font = { bold: true }
    r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_SECCION } }
    return r
  }
  // Pares etiqueta/valor en dos columnas (izq: A-B, der: D-E).
  const pares = (izq: Array<[string, string | number | Date | null]>, der: Array<[string, string | number | Date | null]> = []) => {
    const n = Math.max(izq.length, der.length)
    for (let i = 0; i < n; i++) {
      const [li, vi] = izq[i] ?? ['', null]
      const [ld, vd] = der[i] ?? ['', null]
      const r = ws.addRow([li, li ? (vi ?? '—') : '', '', ld, ld ? (vd ?? '—') : ''])
      r.getCell(1).font = { bold: true }
      r.getCell(4).font = { bold: true }
      for (const c of [2, 5]) {
        if (r.getCell(c).value instanceof Date) r.getCell(c).numFmt = FMT_FECHA
        r.getCell(c).alignment = { wrapText: true, vertical: 'top', horizontal: 'left' }
      }
    }
  }
  const blanco = () => ws.addRow([])

  // ── Encabezado ──
  const rTitulo = ws.addRow([titulo])
  ws.mergeCells(rTitulo.number, 1, rTitulo.number, 5)
  rTitulo.getCell(1).font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
  rTitulo.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TITULO } }
  rTitulo.height = 24
  const facturaConFolio = d.variante === 'FACTURA' && d.folio != null
  pares(
    [[t.numero, facturaConFolio ? String(d.folio) : d.codigo], ...(facturaConFolio ? [[t.codigoInterno, d.codigo] as [string, string]] : [])],
    [[t.emision, fecha(d.fechaEmision)]],
  )
  blanco()

  // ── Exportador / Cliente ──
  const rEc = ws.addRow([t.exportador.toUpperCase(), '', '', t.cliente.toUpperCase()])
  rEc.font = { bold: true }
  for (const c of [1, 4]) rEc.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_SECCION } }
  ws.mergeCells(rEc.number, 1, rEc.number, 2)
  ws.mergeCells(rEc.number, 4, rEc.number, 5)
  pares(
    [
      [t.razonSocial, exp.razonSocial],
      expExtranjero ? [t.taxId, ('taxId' in exp ? exp.taxId : null) ?? null] : [t.rut, exp.rut],
      [t.direccion, expLineas ? expLineas.join(', ') : exp.direccion],
      ...(exp.telefono ? [[t.telefono, exp.telefono] as Par] : []),
      ...((exp.contactosDocumentales ?? []).length > 0 ? contactos(exp.contactosDocumentales) : [[t.contacto, null] as Par]),
    ],
    [
      [t.razonSocial, d.cliente.razonSocial],
      [t.rut, d.cliente.rut],
      [t.direccion, d.cliente.direccion],
      [t.pais, d.cliente.pais ?? null],
      [t.numeroInstructivo, d.numeroInstructivo],
      [t.condicionPago, condicionPagoTexto],
    ],
  )
  blanco()

  // ── Consignatario / Notify ──
  if (d.consignatario || d.notify) {
    const rCn = ws.addRow([d.consignatario ? t.consignatario.toUpperCase() : '', '', '', d.notify ? t.notify.toUpperCase() : ''])
    rCn.font = { bold: true }
    if (d.consignatario) rCn.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_SECCION } }
    if (d.notify) rCn.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_SECCION } }
    ws.mergeCells(rCn.number, 1, rCn.number, 2)
    ws.mergeCells(rCn.number, 4, rCn.number, 5)
    const actor = (a: ProformaPdfPayload['notify']): Par[] =>
      a ? [[t.razonSocial, a.razonSocial], [t.rut, a.rut], [t.direccion, a.direccion], ...contactos(a.contactosDocumentales)] : []
    pares(actor(d.consignatario), actor(d.notify))
    blanco()
  }

  // ── Transporte ──
  const tr = d.transporte
  if (tr) {
    seccion(t.transporte.toUpperCase())
    pares(
      [
        [t.via, tr.via],
        [t.nave, tr.nave],
        [t.blAwb, tr.blAwb],
        [t.tipoBl, tr.tipoBl],
        [t.booking, tr.booking],
        [t.contenedor, tr.contenedor],
        [t.sello, tr.sello],
        [t.dus, tr.dus ?? null],
      ],
      [
        [t.puertoEmbarque, tr.puertoEmbarque],
        [t.puertoDestino, tr.puertoDestino],
        [t.etd, fecha(tr.etd)],
        [t.eta, fecha(tr.eta)],
        [t.incoterm, tr.incoterm],
        [t.modalidadVenta, tr.modalidadVenta],
        [t.fleteTransporte, tr.flete],
        ...(d.pesoNeto != null ? [[`${t.pesoNeto} (kg)`, d.pesoNeto] as [string, number]] : []),
        ...(d.pesoBruto != null ? [[`${t.pesoBruto} (kg)`, d.pesoBruto] as [string, number]] : []),
      ],
    )
    blanco()
  }

  // ── Detalle ──
  seccion(t.detalle.toUpperCase())
  const rCab = ws.addRow([t.detalle, '', t.cantidad, `${t.precioUnitario} (${d.moneda})`, `${t.monto} (${d.moneda})`])
  rCab.font = { bold: true }
  ws.mergeCells(rCab.number, 1, rCab.number, 2)
  rCab.eachCell((c) => { c.border = { bottom: { style: 'thin' } } })
  for (const l of d.lineas) {
    const r = ws.addRow([l.descripcion, '', l.cantidadCajas, l.precioUnitario, l.montoLinea])
    ws.mergeCells(r.number, 1, r.number, 2)
    r.getCell(1).alignment = { wrapText: true, vertical: 'top' }
    r.getCell(3).numFmt = FMT_ENTERO
    r.getCell(4).numFmt = FMT_MONTO
    r.getCell(5).numFmt = FMT_MONTO
  }
  const totalCajas = d.lineas.reduce((a, l) => a + l.cantidadCajas, 0)
  const rSub = ws.addRow([tieneDesglose ? t.subtotalFob : t.total, '', totalCajas, '', tieneDesglose ? d.subtotalFob : d.montoTotal])
  ws.mergeCells(rSub.number, 1, rSub.number, 2)
  rSub.font = { bold: true }
  rSub.getCell(3).numFmt = FMT_ENTERO
  rSub.getCell(5).numFmt = FMT_MONTO
  rSub.eachCell((c) => { c.border = { top: { style: 'thin' } } })

  // ── Totales (desglose de la cláusula) ──
  if (tieneDesglose) {
    const fila = (label: string, valor: number, negrita = false) => {
      const r = ws.addRow(['', '', '', label, valor])
      r.getCell(5).numFmt = FMT_MONTO
      r.getCell(4).font = { bold: negrita }
      r.getCell(5).font = { bold: negrita }
    }
    if (d.montoFlete != null) fila(t.flete, d.montoFlete)
    if (d.montoSeguro != null) fila(t.seguro, d.montoSeguro)
    fila(`${t.total} (${d.moneda})`, d.montoTotal, true)
  }
  if (d.totalCajas != null || d.totalPallets != null) {
    const r = ws.addRow(['', '', '', t.totalCajas, d.totalCajas ?? null])
    r.getCell(4).font = { bold: true }
    r.getCell(5).numFmt = FMT_ENTERO
    const r2 = ws.addRow(['', '', '', t.totalPallets, d.totalPallets ?? null])
    r2.getCell(4).font = { bold: true }
    r2.getCell(5).numFmt = FMT_ENTERO
  }
  if (d.montoEnPalabras) {
    const r = ws.addRow([`${t.montoEnPalabras}: ${d.montoEnPalabras}`])
    ws.mergeCells(r.number, 1, r.number, 5)
    r.getCell(1).alignment = { wrapText: true }
  }
  blanco()

  // ── Vencimientos ──
  if (d.vencimientosEstimados.length > 0) {
    seccion(t.vencimientos.toUpperCase())
    const rV = ws.addRow([t.cuota, t.referencia, t.plazo, t.fechaEstimada, `${t.monto} (${d.moneda})`])
    rV.font = { bold: true }
    rV.eachCell((c) => { c.border = { bottom: { style: 'thin' } } })
    for (const v of d.vencimientosEstimados) {
      const r = ws.addRow([
        `#${v.numeroCuota}${v.descripcion ? ` — ${v.descripcion}` : ''}`,
        t.fechaReferencia[v.fechaReferencia],
        v.plazoDias,
        fecha(v.fechaEstimada) ?? t.pendiente,
        v.monto,
      ])
      if (r.getCell(4).value instanceof Date) r.getCell(4).numFmt = FMT_FECHA
      r.getCell(5).numFmt = FMT_MONTO
    }
    blanco()
  }

  // ── Observaciones ──
  if (d.observaciones) {
    seccion(t.observaciones.toUpperCase())
    const r = ws.addRow([d.observaciones])
    ws.mergeCells(r.number, 1, r.number, 5)
    r.getCell(1).alignment = { wrapText: true, vertical: 'top' }
    r.height = Math.min(15 * (d.observaciones.split('\n').length + 1), 200)
  }

  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out as ArrayBuffer)
}
