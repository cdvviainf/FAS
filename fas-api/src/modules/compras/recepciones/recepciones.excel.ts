// Lector de Excel de Recepción (compras.md §9.2 + §7). Usa el mapeo del
// TemplateCarga (columna por campo, fila de inicio) para extraer filas
// crudas — sin resolver todavía contra los maestros (eso lo hace el motor,
// recepciones.motor.ts, en su Etapa 3).
//
// Etapa 1 del motor (validar que el Template esté bien mapeado contra el
// Excel real) vive acá: resolverMapeoColumnas() nunca corta al primer
// problema — junta TODAS las columnas que falten antes de que el motor
// decida si aborta.
import ExcelJS from 'exceljs'
import { ValidationError } from '../../../shared/errors.js'
import { CAMPOS_POR_TIPO, CAMPO_TEMPLATE_CARGA_LABELS } from '../../config/templates-carga/templates-carga.types.js'

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
  // Opcionales (compras.md §4.8, 2026-09-02) — el Template puede no
  // mapearlas y, si las mapea, la celda puede venir vacía.
  notaCalidad: string
  notaCondicion: string
  completo: string
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
  //   = espacio de no separación (NBSP) — Excel exportado desde otros
  // sistemas (ej. planillas de plantas/despachadores) suele meterlo en vez
  // de un espacio normal; a simple vista es indistinguible de un espacio,
  // pero rompe la comparación exacta del título de columna (Etapa 1).
  return String(valor).replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
}

// Mismo criterio de normalización que textoCelda(), aplicado también al
// título configurado en el Template de Carga — para que un NBSP escondido
// en cualquiera de los dos lados no impida el match.
function normalizarEncabezado(s: string): string {
  return s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
}

export async function cargarPrimeraHoja(buffer: Buffer): Promise<ExcelJS.Worksheet> {
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
  return hoja
}

// Etapa 1: que el Template de Carga mapee columnas que de verdad existen en
// este Excel. No resuelve nada de datos todavía — solo valida el mapeo.
// Junta TODAS las columnas que falten (no corta en la primera).
export function resolverMapeoColumnas(
  hoja: ExcelJS.Worksheet,
  template: TemplateParaLectura,
): { indicePorCampo: Map<string, number>; errores: string[] } {
  const indicePorCampo = new Map<string, number>()
  const errores: string[] = []

  if (template.tieneCabecera) {
    const filaCab = hoja.getRow(template.filaCabecera!)
    const encabezadosEncontrados: string[] = []
    filaCab.eachCell({ includeEmpty: false }, (cell) => {
      const texto = textoCelda(cell.value)
      if (texto) encabezadosEncontrados.push(texto)
    })

    for (const c of template.campos) {
      let idx: number | null = null
      filaCab.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (normalizarEncabezado(textoCelda(cell.value)) === normalizarEncabezado(c.columna)) idx = colNumber
      })
      if (idx == null) {
        const label = CAMPO_TEMPLATE_CARGA_LABELS[c.campo] ?? c.campo
        errores.push(
          `No se encontró la columna "${c.columna}" (campo ${label}) en la fila de cabecera (fila ${template.filaCabecera}) del Excel — ` +
            `columnas encontradas en esa fila: ${encabezadosEncontrados.map((h) => `"${h}"`).join(', ') || '(ninguna)'}`,
        )
      } else {
        indicePorCampo.set(c.campo, idx)
      }
    }
  } else {
    for (const c of template.campos) indicePorCampo.set(c.campo, columnaLetraAIndice(c.columna))
  }

  return { indicePorCampo, errores }
}

// Etapa 1.5 (extracción pura, no valida contenido): asume que
// resolverMapeoColumnas() ya no tiene errores. La validación de que cada
// fila esté completa y con datos válidos es la Etapa 2, en el motor.
export function leerFilasCrudas(
  hoja: ExcelJS.Worksheet,
  template: TemplateParaLectura,
  indicePorCampo: Map<string, number>,
): FilaExcelCruda[] {
  const filas: FilaExcelCruda[] = []
  let fila = template.filaPrimerRegistro
  while (fila - template.filaPrimerRegistro < MAX_FILAS) {
    const row = hoja.getRow(fila)
    const valores: Record<string, string> = {}
    for (const campo of CAMPOS_POR_TIPO.RECEPCION) {
      const idx = indicePorCampo.get(campo)
      valores[campo] = idx ? textoCelda(row.getCell(idx).value) : ''
    }
    // N° de Pallet vacío = fin de la tabla de datos, no un error. Un
    // Packing List real casi siempre trae filas de cierre después del
    // último pallet (Total, Firma Despachador, Firma Recibe...) que sí
    // tienen texto en alguna columna pero nunca un N° de Pallet propio —
    // tratarlas como "fila vacía" (que exige TODAS las columnas vacías)
    // las dejaba pasar como datos y el motor las rechazaba con errores que
    // no tienen sentido para el usuario (ej. "Especie 'Total' no existe").
    if (!valores.NUMERO_PALLET) break
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
      notaCalidad: valores.NOTA_CALIDAD,
      notaCondicion: valores.NOTA_CONDICION,
      completo: valores.COMPLETO,
    })
    fila++
  }

  if (filas.length === 0) {
    throw new ValidationError(`El Excel no tiene filas de datos a partir de la fila ${template.filaPrimerRegistro} configurada en el Template de Carga`)
  }
  return filas
}
