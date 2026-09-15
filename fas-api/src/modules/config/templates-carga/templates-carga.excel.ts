// Generador del "formato base" de un Template de Carga: un Excel en blanco
// con las columnas exactas que el lector (recepciones.excel.ts) espera para
// ESE template, listo para que el usuario lo llene y lo suba.
//
// - Con cabecera: pone los títulos configurados (columna) en la fila de
//   cabecera. El lector empareja por nombre de columna, así que el orden no
//   importa (se usa el orden canónico del tipo por prolijidad).
// - Sin cabecera: el lector lee por LETRA de columna; se deja una fila guía
//   con las etiquetas ANTES de la primera fila de datos (el lector la ignora).
import ExcelJS from 'exceljs'
import { CAMPOS_POR_TIPO, CAMPO_TEMPLATE_CARGA_LABELS } from './templates-carga.types.js'

export interface TemplateParaFormato {
  codigo: string
  tipo: string
  descripcion: string
  tieneCabecera: boolean
  filaCabecera: number | null
  filaPrimerRegistro: number
  campos: Array<{ campo: string; columna: string }>
}

function columnaLetraAIndice(letra: string): number {
  let idx = 0
  for (const ch of letra.trim().toUpperCase()) idx = idx * 26 + (ch.charCodeAt(0) - 64)
  return idx
}

export async function generarFormatoBase(t: TemplateParaFormato): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'FAS — Formato de Carga'
  wb.created = new Date()
  const ws = wb.addWorksheet('Datos')

  // Orden canónico del tipo (los campos no listados van al final).
  const orden = (CAMPOS_POR_TIPO[t.tipo as keyof typeof CAMPOS_POR_TIPO] ?? []) as readonly string[]
  const camposOrdenados = [...t.campos].sort(
    (a, b) => (orden.indexOf(a.campo) + 1 || 999) - (orden.indexOf(b.campo) + 1 || 999),
  )

  if (t.tieneCabecera) {
    const filaCab = t.filaCabecera ?? 1
    camposOrdenados.forEach((c, i) => {
      const cell = ws.getCell(filaCab, i + 1)
      cell.value = c.columna // título EXACTO que empareja el lector
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.note = CAMPO_TEMPLATE_CARGA_LABELS[c.campo] ?? c.campo
      ws.getColumn(i + 1).width = Math.max(16, c.columna.length + 2)
    })
    ws.getRow(filaCab).height = 24
    ws.views = [{ state: 'frozen', ySplit: filaCab }]
  } else {
    // Sin cabecera: fila guía (informativa) justo antes de los datos.
    const filaGuia = Math.max(1, t.filaPrimerRegistro - 1)
    for (const c of camposOrdenados) {
      const idx = columnaLetraAIndice(c.columna)
      if (idx <= 0) continue
      const label = CAMPO_TEMPLATE_CARGA_LABELS[c.campo] ?? c.campo
      const cell = ws.getCell(filaGuia, idx)
      cell.value = label
      cell.font = { italic: true, color: { argb: 'FF888888' } }
      ws.getColumn(idx).width = Math.max(16, label.length + 2)
    }
    ws.views = [{ state: 'frozen', ySplit: filaGuia }]
  }

  return wb.xlsx.writeBuffer()
}
