import ExcelJS from 'exceljs'
import type { ColumnaSpec, HojaSpec } from './tipos.js'

// ─── Generador del Excel base vacío (portable) ───────────────────────────────
//
// A partir de un `HojaSpec[]` produce el libro de Carga Masiva: hoja de
// Instrucciones, hoja de ListasFijas (fuente de los dropdowns), y una hoja por
// maestro con encabezados, obligatorios resaltados, comentarios de ayuda y
// validaciones de lista (dropdowns) para enums y FKs internas.

const VERDE_OBLIGATORIO = 'FFDDF3DD' // fondo celda obligatoria
const AZUL_ENCABEZADO = 'FF1F4E78'
const FILAS_VALIDACION = 2000 // hasta qué fila aplican los dropdowns

function letraColumna(indice1: number): string {
  let n = indice1
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** Índice 1-based de la columna 'codigo' de una hoja (para apuntar dropdowns de FK interna). */
function indiceColumnaCodigo(hoja: HojaSpec): number {
  const i = hoja.columnas.findIndex((c) => c.campo === 'codigo')
  return i >= 0 ? i + 1 : 1
}

function construirListasFijas(wb: ExcelJS.Workbook, listas: Record<string, string[]>): Record<string, string> {
  const ws = wb.addWorksheet('ListasFijas', { properties: { tabColor: { argb: 'FFBDBDBD' } } })
  const rangos: Record<string, string> = {}
  let col = 1
  for (const [nombre, valores] of Object.entries(listas)) {
    const letra = letraColumna(col)
    ws.getCell(`${letra}1`).value = nombre
    ws.getCell(`${letra}1`).font = { bold: true }
    valores.forEach((v, i) => {
      ws.getCell(`${letra}${i + 2}`).value = v
    })
    ws.getColumn(col).width = Math.max(14, ...valores.map((v) => v.length + 2))
    rangos[nombre] = `ListasFijas!$${letra}$2:$${letra}$${valores.length + 1}`
    col++
  }
  ws.state = 'veryHidden'
  return rangos
}

function agregarHojaInstrucciones(wb: ExcelJS.Workbook, hojas: HojaSpec[], titulo: string, fueraDeAlcance: string[]) {
  const ws = wb.addWorksheet('Instrucciones', { properties: { tabColor: { argb: 'FF1F4E78' } } })
  ws.getColumn(1).width = 120
  const hayReferencia = hojas.some((h) => h.soloReferencia)
  const lineas: Array<[string, boolean]> = [
    [titulo, true],
    ['', false],
    ['Cómo usar este archivo:', true],
    ['1. Completa las hojas de datos en el orden en que aparecen (de izquierda a derecha). Cada hoja puede depender de códigos creados en una hoja anterior.', false],
    ['2. Las celdas de encabezado con fondo verde son columnas obligatorias.', false],
    ['3. Las columnas "Código" propias de cada registro pueden dejarse vacías: el sistema genera el código automáticamente (según Prefijos de Código). Excepciones: País (ISO alfa-3) y Predio (único por productor).', false],
    ['4. Las columnas marcadas "(código, ya existente)" hacen referencia a datos que YA DEBEN EXISTIR en el sistema. No se crean en este archivo.', false],
    ['5. No cambies los nombres de las hojas ni el orden/nombre de las columnas: el motor de carga los usa para saber qué registro y qué campo corresponde a cada dato.', false],
    ['6. El sistema valida cada hoja por separado: si una hoja tiene filas con error, se cargan las filas válidas y se reportan las erróneas.', false],
    ['7. Esta carga asume que el registro no existe: si un código ya existe, la fila queda como error (no se actualiza el registro existente).', false],
  ]
  if (hayReferencia) {
    lineas.push(['8. Las hojas con pestaña gris son de SOLO REFERENCIA (datos ya existentes en el sistema): úsalas para copiar los códigos correctos en las hojas de datos. No las edites.', false])
  }
  lineas.push(['', false])
  lineas.push(['Hojas incluidas y de qué dependen:', true])
  for (const h of hojas) {
    if (h.soloReferencia) {
      lineas.push([`  ${h.titulo} — SOLO REFERENCIA. ${h.descripcion}`, false])
      continue
    }
    const dep = h.dependeDe.length ? `depende de: ${h.dependeDe.join(', ')}` : 'independiente'
    lineas.push([`  ${h.titulo} — ${dep}. ${h.descripcion}`, false])
  }
  if (fueraDeAlcance.length) {
    lineas.push(['', false])
    lineas.push(['Fuera de alcance de esta carga (se agregan por separado):', true])
    for (const f of fueraDeAlcance) lineas.push([`  - ${f}`, false])
  }

  lineas.forEach(([texto, negrita], i) => {
    const cell = ws.getCell(`A${i + 1}`)
    cell.value = texto
    cell.font = { bold: negrita, size: i === 0 ? 14 : 11 }
    cell.alignment = { wrapText: true, vertical: 'top' }
  })
}

function agregarHojaMaestro(
  wb: ExcelJS.Workbook,
  hoja: HojaSpec,
  rangos: Record<string, string>,
  letraCodigoPorHoja: Record<string, string>,
  datos?: Array<Record<string, unknown>>,
) {
  const ws = wb.addWorksheet(
    hoja.hoja,
    hoja.soloReferencia ? { properties: { tabColor: { argb: 'FFBDBDBD' } } } : undefined,
  )
  hoja.columnas.forEach((col, i) => {
    const idx = i + 1
    const letra = letraColumna(idx)
    const cell = ws.getCell(`${letra}1`)
    cell.value = col.encabezado
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: col.requerido ? VERDE_OBLIGATORIO : AZUL_ENCABEZADO },
    }
    if (col.requerido) cell.font = { bold: true, color: { argb: 'FF1B5E20' } }
    cell.alignment = { wrapText: true, vertical: 'middle' }
    if (col.ayuda) cell.note = col.ayuda
    ws.getColumn(idx).width = Math.min(42, Math.max(16, col.encabezado.length + 2))

    // Las hojas de solo-referencia no llevan validaciones (son de lectura).
    if (!hoja.soloReferencia) aplicarValidacion(ws, letra, col, rangos, letraCodigoPorHoja)
  })

  // Datos precargados (hojas de referencia): una fila por registro de la BD,
  // mapeando cada columna por su `campo`.
  if (datos?.length) {
    datos.forEach((registro, r) => {
      hoja.columnas.forEach((col, i) => {
        if (!col.campo) return
        const v = registro[col.campo]
        if (v != null) ws.getCell(r + 2, i + 1).value = v as ExcelJS.CellValue
      })
    })
  }

  ws.getRow(1).height = 42
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}

function aplicarValidacion(
  ws: ExcelJS.Worksheet,
  letra: string,
  col: ColumnaSpec,
  rangos: Record<string, string>,
  letraCodigoPorHoja: Record<string, string>,
) {
  const rango = `${letra}2:${letra}${FILAS_VALIDACION}`
  if (col.tipo === 'booleanSiNo') {
    (ws as any).dataValidations.add(rango, { type: 'list', allowBlank: true, formulae: ['"SI,NO"'] })
    return
  }
  if (col.tipo === 'enum' && col.enumValores) {
    const nombreLista = mapaEnumALista(col.enumValores)
    if (nombreLista && rangos[nombreLista]) {
      (ws as any).dataValidations.add(rango, { type: 'list', allowBlank: !col.requerido, formulae: [rangos[nombreLista]] })
    }
    return
  }
  // enumMulti: Excel no soporta multiselección nativa; se deja texto libre y la
  // lista de valores permitidos va en el comentario del encabezado.
  if (col.tipo === 'fk' && col.fk?.hoja) {
    const codeLetra = letraCodigoPorHoja[col.fk.hoja]
    if (codeLetra) {
      (ws as any).dataValidations.add(rango, {
        type: 'list',
        allowBlank: !col.requerido,
        formulae: [`'${col.fk.hoja}'!$${codeLetra}$2:$${codeLetra}$${FILAS_VALIDACION}`],
      })
    }
  }
}

// Asocia una lista de enum concreta con su columna en ListasFijas por identidad.
let LISTAS_ENUM: Record<string, string[]> = {}
function mapaEnumALista(valores: string[]): string | null {
  for (const [nombre, vals] of Object.entries(LISTAS_ENUM)) {
    if (vals.length === valores.length && vals.every((v, i) => v === valores[i])) return nombre
  }
  return null
}

export interface OpcionesGenerar {
  /** Listas de enums a materializar en ListasFijas (nombre -> valores). */
  listasEnum: Record<string, string[]>
  /**
   * Datos a precargar por hoja (para hojas `soloReferencia`): nombre de hoja ->
   * filas, cada fila mapeada por `campo`. Ej. { Entidades: [{ codigo, descripcion }] }.
   */
  datosPorHoja?: Record<string, Array<Record<string, unknown>>>
  /** Título de la hoja de Instrucciones. */
  titulo?: string
  /** Ítems "fuera de alcance" a listar al final de las instrucciones. */
  fueraDeAlcance?: string[]
}

export async function generarTemplate(hojas: HojaSpec[], opciones: OpcionesGenerar): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'FAS — Carga Masiva de Maestros'
  wb.created = new Date()

  LISTAS_ENUM = opciones.listasEnum
  const listas: Record<string, string[]> = { SiNo: ['SI', 'NO'], ...opciones.listasEnum }

  agregarHojaInstrucciones(
    wb,
    hojas,
    opciones.titulo ?? 'CARGA MASIVA DE MAESTROS — FRUTERA AGROSAN',
    opciones.fueraDeAlcance ?? ['Direcciones y Contactos de Entidad', 'Documentos adjuntos de Artículo'],
  )
  const rangos = construirListasFijas(wb, listas)

  // Letra de la columna 'codigo' por hoja, para dropdowns de FK interna.
  const letraCodigoPorHoja: Record<string, string> = {}
  for (const h of hojas) letraCodigoPorHoja[h.hoja] = letraColumna(indiceColumnaCodigo(h))

  for (const h of hojas) agregarHojaMaestro(wb, h, rangos, letraCodigoPorHoja, opciones.datosPorHoja?.[h.hoja])

  return wb.xlsx.writeBuffer()
}
