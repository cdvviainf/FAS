// Lector de Excel de Recepción (compras.md §9.2 + §7). Usa el mapeo del
// TemplateCarga (columna por campo, fila de inicio) para extraer filas
// crudas — sin resolver todavía contra los maestros (eso lo hace el motor,
// recepciones.motor.ts).
import ExcelJS from 'exceljs'
import { ValidationError } from '../../../shared/errors.js'
import { CAMPOS_POR_TIPO } from '../../config/templates-carga/templates-carga.types.js'

export interface FilaExcelCruda {
  fila: number
  numeroPallet: string
  especie: string
  variedad: string
  categoria: string
  articulo: string
  calibre: string
  cajas: string
  productor: string
}

interface TemplateParaLectura {
  tieneCabecera: boolean
  filaCabecera: number | null
  filaPrimerRegistro: number
  campos: Array<{ campo: string; columna: string }>
}

const MAX_FILAS = 5000 // guarda de seguridad ante un Excel sin filas vacías

function columnaLetraAIndice(letra: string): number {
  let idx = 0
  for (const ch of letra.trim().toUpperCase()) {
    idx = idx * 26 + (ch.charCodeAt(0) - 64)
  }
  return idx
}

// cell.value de ExcelJS puede venir como string, number, Date, o un objeto
// (rich text / resultado de fórmula) según el tipo de celda — normalizamos
// todo a texto plano y recortado.
function textoCelda(valor: ExcelJS.CellValue): string {
  if (valor == null) return ''
  if (valor instanceof Date) return valor.toISOString()
  if (typeof valor === 'object') {
    if ('richText' in valor) return valor.richText.map((r) => r.text).join('')
    if ('result' in valor) return textoCelda(valor.result as ExcelJS.CellValue)
    if ('text' in valor) return String((valor as { text: unknown }).text ?? '')
    return ''
  }
  return String(valor).trim()
}

export async function leerFilasExcel(buffer: Buffer, template: TemplateParaLectura): Promise<FilaExcelCruda[]> {
  const wb = new ExcelJS.Workbook()
  try {
    // El .d.ts de exceljs declara su propio Buffer que no coincide
    // estructuralmente con el de @types/node en este proyecto (mismatch
    // puramente de tipos — en runtime es el mismo Buffer de siempre).
    await wb.xlsx.load(buffer as any)
  } catch {
    throw new ValidationError('No se pudo leer el archivo. Verifica que sea un Excel (.xlsx) válido y no esté dañado.')
  }
  const hoja = wb.worksheets[0]
  if (!hoja) throw new ValidationError('El archivo Excel no tiene ninguna hoja')

  // Resolver, para cada campo del template, el índice de columna a leer.
  const indicePorCampo = new Map<string, number>()
  if (template.tieneCabecera) {
    const filaCab = hoja.getRow(template.filaCabecera!)
    for (const c of template.campos) {
      let idx: number | null = null
      filaCab.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (textoCelda(cell.value).toLowerCase() === c.columna.trim().toLowerCase()) idx = colNumber
      })
      if (idx == null) {
        throw new ValidationError(
          `No se encontró la columna "${c.columna}" en la fila de cabecera (fila ${template.filaCabecera}) del Excel — revisa el Template de Carga o el archivo.`,
        )
      }
      indicePorCampo.set(c.campo, idx)
    }
  } else {
    for (const c of template.campos) indicePorCampo.set(c.campo, columnaLetraAIndice(c.columna))
  }

  const filas: FilaExcelCruda[] = []
  let fila = template.filaPrimerRegistro
  let vaciasSeguidas = 0
  while (fila - template.filaPrimerRegistro < MAX_FILAS) {
    const row = hoja.getRow(fila)
    const valores: Record<string, string> = {}
    for (const campo of CAMPOS_POR_TIPO.RECEPCION) {
      const idx = indicePorCampo.get(campo)
      valores[campo] = idx ? textoCelda(row.getCell(idx).value) : ''
    }
    const vacia = Object.values(valores).every((v) => v === '')
    if (vacia) {
      vaciasSeguidas++
      // Dos filas vacías seguidas: se asume fin de los datos (una sola fila
      // vacía suelta en medio de la planilla no corta la lectura).
      if (vaciasSeguidas >= 2) break
    } else {
      vaciasSeguidas = 0
      filas.push({
        fila,
        numeroPallet: valores.NUMERO_PALLET,
        especie: valores.ESPECIE,
        variedad: valores.VARIEDAD,
        categoria: valores.CATEGORIA,
        articulo: valores.ARTICULO,
        calibre: valores.CALIBRE,
        cajas: valores.CAJAS,
        productor: valores.PRODUCTOR,
      })
    }
    fila++
  }

  if (filas.length === 0) {
    throw new ValidationError(`El Excel no tiene filas de datos a partir de la fila ${template.filaPrimerRegistro} configurada en el Template de Carga`)
  }
  return filas
}
