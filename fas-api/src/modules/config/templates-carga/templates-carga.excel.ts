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

// Guía de precarga/validación de un campo a partir de la Orden de Compra
// (2026-10-14): si la OC tiene un único valor para el campo se PRECARGA en todas
// las filas; si tiene varios, se restringe con un dropdown (data validation).
export interface GuiaOcCampo {
  precarga?: string
  opciones?: string[]
}

export interface FormatoBaseOpciones {
  // Nº de filas de datos a pre-generar (para la descarga guiada por OC). Si no
  // se pasa (o es <= 0) se devuelve el formato en blanco de siempre.
  filas?: number
  // Guía por `campo` (ESPECIE, VARIEDAD, CALIBRE, ...).
  guia?: Record<string, GuiaOcCampo>
}

function columnaLetraAIndice(letra: string): number {
  let idx = 0
  for (const ch of letra.trim().toUpperCase()) idx = idx * 26 + (ch.charCodeAt(0) - 64)
  return idx
}

function indiceAColumnaLetra(idx: number): string {
  let s = ''
  let n = idx
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export async function generarFormatoBase(t: TemplateParaFormato, opts?: FormatoBaseOpciones): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'FAS — Formato de Carga'
  wb.created = new Date()
  const ws = wb.addWorksheet('Datos')

  // Orden canónico del tipo (los campos no listados van al final).
  const orden = (CAMPOS_POR_TIPO[t.tipo as keyof typeof CAMPOS_POR_TIPO] ?? []) as readonly string[]
  const camposOrdenados = [...t.campos].sort(
    (a, b) => (orden.indexOf(a.campo) + 1 || 999) - (orden.indexOf(b.campo) + 1 || 999),
  )

  // Mapa campo -> índice de columna (1-based), para precargar/validar datos.
  const colPorCampo = new Map<string, number>()

  if (t.tieneCabecera) {
    const filaCab = t.filaCabecera ?? 1
    camposOrdenados.forEach((c, i) => {
      colPorCampo.set(c.campo, i + 1)
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
      colPorCampo.set(c.campo, idx)
      const label = CAMPO_TEMPLATE_CARGA_LABELS[c.campo] ?? c.campo
      const cell = ws.getCell(filaGuia, idx)
      cell.value = label
      cell.font = { italic: true, color: { argb: 'FF888888' } }
      ws.getColumn(idx).width = Math.max(16, label.length + 2)
    }
    ws.views = [{ state: 'frozen', ySplit: filaGuia }]
  }

  // Descarga guiada por OC: pre-generar N filas con los valores de la OC
  // (precarga de valores únicos + dropdowns para los multivalor).
  const filas = opts?.filas ?? 0
  const guia = opts?.guia
  if (filas > 0 && guia) {
    const filaInicio = t.filaPrimerRegistro
    const filaFin = filaInicio + filas - 1

    // Hoja oculta con las listas de opciones (una columna por campo multivalor);
    // la data validation apunta a su rango. El lector de carga la ignora.
    let listas: ExcelJS.Worksheet | null = null
    let colListas = 0

    for (const [campo, g] of Object.entries(guia)) {
      const col = colPorCampo.get(campo)
      if (!col) continue // el campo no está mapeado en este template → se omite

      if (g.precarga != null && g.precarga !== '') {
        for (let r = filaInicio; r <= filaFin; r++) ws.getCell(r, col).value = g.precarga
        continue
      }

      if (g.opciones && g.opciones.length > 0) {
        if (!listas) {
          listas = wb.addWorksheet('Listas')
          listas.state = 'veryHidden'
        }
        colListas += 1
        g.opciones.forEach((op, i) => {
          listas!.getCell(i + 1, colListas).value = op
        })
        const letra = indiceAColumnaLetra(colListas)
        const rango = `Listas!$${letra}$1:$${letra}$${g.opciones.length}`
        for (let r = filaInicio; r <= filaFin; r++) {
          ws.getCell(r, col).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [rango],
            showErrorMessage: true,
            errorStyle: 'error',
            errorTitle: 'Valor fuera de la Orden de Compra',
            error: 'Elige uno de los valores permitidos por la Orden de Compra.',
          }
        }
      }
    }
  }

  return wb.xlsx.writeBuffer()
}
