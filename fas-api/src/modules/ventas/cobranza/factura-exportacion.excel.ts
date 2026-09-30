// Exportación a Excel de la Factura de Exportación — mismo contenido que la
// Factura Comercial (PDF): reusa el payload que ya arma
// `resolverFacturaExportacion` (documentos/resolvers/factura-exportacion.resolver.ts)
// en vez de re-derivar FOB/idioma/desglose una segunda vez. Mismo criterio de
// estilo que templates-carga.excel.ts (encabezado azul, header congelado).
import ExcelJS from 'exceljs'
import type { ProformaPdfPayload } from '../../documentos/schemas/proforma.schema.js'

const AZUL_ENCABEZADO = 'FF1F4E78'
const BLANCO = 'FFFFFFFF'

function estiloEncabezado(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: BLANCO } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ENCABEZADO } }
  cell.alignment = { vertical: 'middle' }
}

export async function generarExcelFacturaExportacion(d: ProformaPdfPayload): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'FAS — Facturación Exportación'
  wb.created = new Date()
  const ws = wb.addWorksheet('Factura')

  ws.getColumn(1).width = 26
  ws.getColumn(2).width = 40
  ws.getColumn(3).width = 14
  ws.getColumn(4).width = 16

  // ─── Encabezado ─────────────────────────────────────────────────────────
  ws.mergeCells('A1:D1')
  const titulo = ws.getCell('A1')
  titulo.value = `${d.variante === 'FACTURA' ? 'Factura Comercial de Exportación' : 'Proforma'} ${d.codigo}${d.folio != null ? ` — Folio ${d.folio}` : ''}`
  titulo.font = { bold: true, size: 14 }

  let fila = 3
  const campo = (label: string, valor: string | number | null) => {
    ws.getCell(fila, 1).value = label
    ws.getCell(fila, 1).font = { bold: true }
    ws.getCell(fila, 2).value = valor ?? '—'
    fila++
  }
  campo('Exportador', d.empresa.razonSocial)
  campo('Cliente', d.cliente.razonSocial)
  campo('Embarque', d.numeroInstructivo)
  campo('Fecha', d.fechaEmision.slice(0, 10))
  campo('Moneda', d.moneda)
  campo('Condición de pago', d.condicionPago)
  fila++

  // ─── Líneas ─────────────────────────────────────────────────────────────
  const filaHeaderLineas = fila
  const headersLineas = ['Descripción', 'Cajas', 'Precio Unitario', 'Monto']
  headersLineas.forEach((h, i) => {
    const cell = ws.getCell(filaHeaderLineas, i + 1)
    cell.value = h
    estiloEncabezado(cell)
  })
  fila++

  for (const l of d.lineas) {
    ws.getCell(fila, 1).value = l.descripcion
    ws.getCell(fila, 2).value = l.cantidadCajas
    ws.getCell(fila, 3).value = l.precioUnitario
    ws.getCell(fila, 3).numFmt = '#,##0.0000'
    ws.getCell(fila, 4).value = l.montoLinea
    ws.getCell(fila, 4).numFmt = '#,##0.00'
    fila++
  }
  fila++

  // ─── Desglose de la cláusula de venta ──────────────────────────────────
  const tieneDesglose = d.montoFlete != null || d.montoSeguro != null
  const filaTotal = (label: string, valor: number, negrita = false) => {
    ws.getCell(fila, 3).value = label
    ws.getCell(fila, 4).value = valor
    ws.getCell(fila, 4).numFmt = '#,##0.00'
    if (negrita) {
      ws.getCell(fila, 3).font = { bold: true }
      ws.getCell(fila, 4).font = { bold: true }
    }
    fila++
  }
  filaTotal(tieneDesglose ? 'Valor FOB (mercadería)' : 'Total', tieneDesglose ? d.subtotalFob : d.montoTotal)
  if (d.montoFlete != null) filaTotal('Flete', d.montoFlete)
  if (d.montoSeguro != null) filaTotal('Seguro', d.montoSeguro)
  if (tieneDesglose) filaTotal('Total (valor cláusula)', d.montoTotal, true)
  fila++

  // ─── Cuotas ─────────────────────────────────────────────────────────────
  if (d.vencimientosEstimados.length > 0) {
    const filaHeaderCuotas = fila
    const headersCuotas = ['Cuota', 'Referencia', 'Días', 'Vencimiento', 'Monto']
    headersCuotas.forEach((h, i) => {
      const cell = ws.getCell(filaHeaderCuotas, i + 1)
      cell.value = h
      estiloEncabezado(cell)
    })
    fila++
    for (const c of d.vencimientosEstimados) {
      ws.getCell(fila, 1).value = c.numeroCuota
      ws.getCell(fila, 2).value = c.fechaReferencia
      ws.getCell(fila, 3).value = c.plazoDias
      ws.getCell(fila, 4).value = c.fechaEstimada ? c.fechaEstimada.slice(0, 10) : 'Pendiente'
      ws.getCell(fila, 5).value = c.monto
      ws.getCell(fila, 5).numFmt = '#,##0.00'
      fila++
    }
  }

  ws.views = [{ state: 'frozen', ySplit: filaHeaderLineas }]

  return wb.xlsx.writeBuffer()
}
