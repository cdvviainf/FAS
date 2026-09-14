import ExcelJS from 'exceljs'
import type { ErrorFila } from './tipos.js'

// ─── Reporte de errores (portable) ───────────────────────────────────────────
// Genera un Excel con todos los errores detectados, listos para devolver al
// cliente: una hoja "Resumen" (conteo por hoja) y una hoja "Errores" (detalle
// fila por fila, ubicable en el archivo original).

export async function generarReporteErrores(errores: ErrorFila[]): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'FAS — Carga Masiva de Maestros'

  const resumen = wb.addWorksheet('Resumen')
  resumen.columns = [
    { header: 'Hoja', key: 'hoja', width: 20 },
    { header: 'Errores', key: 'n', width: 12 },
  ]
  resumen.getRow(1).font = { bold: true }
  const porHoja = new Map<string, number>()
  for (const e of errores) porHoja.set(e.hoja, (porHoja.get(e.hoja) ?? 0) + 1)
  for (const [hoja, n] of [...porHoja.entries()].sort((a, b) => b[1] - a[1])) {
    resumen.addRow({ hoja, n })
  }
  resumen.addRow({ hoja: 'TOTAL', n: errores.length }).font = { bold: true }

  const detalle = wb.addWorksheet('Errores')
  detalle.columns = [
    { header: 'Hoja', key: 'hoja', width: 18 },
    { header: 'Fila', key: 'fila', width: 8 },
    { header: 'Columna', key: 'columna', width: 40 },
    { header: 'Tipo', key: 'codigo', width: 22 },
    { header: 'Mensaje', key: 'mensaje', width: 70 },
  ]
  detalle.getRow(1).font = { bold: true }
  detalle.views = [{ state: 'frozen', ySplit: 1 }]
  for (const e of errores) {
    detalle.addRow({ hoja: e.hoja, fila: e.fila || '', columna: e.columna ?? '', codigo: e.codigo, mensaje: e.mensaje })
  }
  detalle.autoFilter = { from: 'A1', to: 'E1' }

  return wb.xlsx.writeBuffer()
}
