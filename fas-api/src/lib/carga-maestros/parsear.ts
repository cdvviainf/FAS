import ExcelJS from 'exceljs'
import type { ColumnaSpec, ErrorFila, FilaParseada, HojaSpec, ResultadoHoja, ResultadoParseo } from './tipos.js'

// ─── Parseo + validación estructural del Excel lleno (portable) ──────────────
//
// Convierte el libro en filas tipadas y coaccionadas, recolectando TODOS los
// errores estructurales (encabezado cambiado, requerido faltante, enum/boolean/
// número inválido). NO resuelve FKs a ids ni toca la BD: eso es responsabilidad
// del orquestador (que conoce el estado de la base y el orden de inserción).

function normalizarTexto(v: unknown): string | undefined {
  if (v == null) return undefined
  // ExcelJS devuelve objetos para varios tipos de celda:
  //   - texto enriquecido: { richText: [{ text }] }
  //   - hipervínculo:      { text, hyperlink }
  //   - fórmula:           { formula, result? }  (result puede no venir cacheado)
  //   - error:             { error: '#N/A' }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if ('richText' in o && Array.isArray(o.richText)) {
      v = (o.richText as Array<{ text: string }>).map((t) => t.text).join('')
    } else if ('result' in o) {
      v = o.result // fórmula con resultado cacheado
    } else if ('text' in o) {
      v = o.text
    } else {
      // Fórmula sin resultado, error, u objeto no textual: no es derivable a
      // texto — se trata como vacío (NUNCA "[object Object]").
      return undefined
    }
    // Si tras desenvolver sigue siendo objeto (ej. text que era richText), corta.
    if (v != null && typeof v === 'object') return normalizarTexto(v)
  }
  if (v == null) return undefined
  const s = String(v).trim()
  return s === '' ? undefined : s
}

const SI = new Set(['SI', 'SÍ', 'S', 'TRUE', 'VERDADERO', '1'])
const NO = new Set(['NO', 'N', 'FALSE', 'FALSO', '0'])

function coaccionar(
  col: ColumnaSpec,
  bruto: unknown,
  ubic: { hoja: string; fila: number },
  errores: ErrorFila[],
): unknown {
  const texto = normalizarTexto(bruto)
  if (texto === undefined) return undefined

  switch (col.tipo) {
    case 'texto':
    case 'textoLargo':
    case 'fk':
      return texto
    case 'entero': {
      const n = Number(texto)
      if (!Number.isInteger(n)) {
        errores.push({ ...ubic, columna: col.encabezado, codigo: 'TIPO_INVALIDO', mensaje: `"${texto}" no es un entero.` })
        return undefined
      }
      return n
    }
    case 'decimal': {
      const n = Number(texto.replace(',', '.'))
      if (Number.isNaN(n)) {
        errores.push({ ...ubic, columna: col.encabezado, codigo: 'TIPO_INVALIDO', mensaje: `"${texto}" no es un número.` })
        return undefined
      }
      return texto.replace(',', '.') // se transporta como string (Decimal)
    }
    case 'booleanSiNo': {
      const up = texto.toUpperCase()
      if (SI.has(up)) return true
      if (NO.has(up)) return false
      errores.push({ ...ubic, columna: col.encabezado, codigo: 'BOOLEAN_INVALIDO', mensaje: `"${texto}" no es SI/NO.` })
      return undefined
    }
    case 'enum': {
      if (col.enumValores && !col.enumValores.includes(texto)) {
        errores.push({ ...ubic, columna: col.encabezado, codigo: 'ENUM_INVALIDO', mensaje: `"${texto}" no está en la lista permitida.` })
        return undefined
      }
      return texto
    }
    case 'enumMulti': {
      const partes = texto.split(/[,;]/).map((p) => p.trim()).filter(Boolean)
      const invalidos = col.enumValores ? partes.filter((p) => !col.enumValores!.includes(p)) : []
      if (invalidos.length) {
        errores.push({ ...ubic, columna: col.encabezado, codigo: 'ENUM_INVALIDO', mensaje: `Valores no permitidos: ${invalidos.join(', ')}.` })
      }
      return partes
    }
    case 'listaControl':
      return texto.split(/[,;]/).map((p) => p.trim()).filter(Boolean)
    default:
      return texto
  }
}

function parsearHoja(ws: ExcelJS.Worksheet | undefined, hoja: HojaSpec, erroresGlobales: ErrorFila[]): ResultadoHoja {
  const filas: FilaParseada[] = []
  const errores: ErrorFila[] = []
  if (!ws) {
    erroresGlobales.push({ hoja: hoja.hoja, fila: 0, codigo: 'HOJA_FALTANTE', mensaje: `Falta la hoja "${hoja.hoja}".` })
    return { hoja: hoja.hoja, filas, errores }
  }

  // Mapear encabezado -> índice de columna (tolera reordenamiento, exige nombres).
  const encHeader = new Map<string, number>()
  const headerRow = ws.getRow(1)
  headerRow.eachCell((cell, col) => {
    const t = normalizarTexto(cell.value)
    if (t) encHeader.set(t, col)
  })
  for (const col of hoja.columnas) {
    // Solo se exige la columna si es obligatoria: una columna opcional que
    // falte (ej. una plantilla anterior sin un campo nuevo) se trata como
    // vacía, sin marcar error.
    if (col.requerido && !encHeader.has(col.encabezado)) {
      erroresGlobales.push({ hoja: hoja.hoja, fila: 1, columna: col.encabezado, codigo: 'ENCABEZADO_FALTANTE', mensaje: `Falta la columna "${col.encabezado}".` })
    }
  }

  const ultima = ws.actualRowCount
  for (let r = 2; r <= ultima; r++) {
    const row = ws.getRow(r)
    // Saltar filas totalmente vacías.
    const algo = hoja.columnas.some((c) => normalizarTexto(row.getCell(encHeader.get(c.encabezado) ?? 0).value) !== undefined)
    if (!algo) continue

    const valores: Record<string, unknown> = {}
    const ubic = { hoja: hoja.hoja, fila: r }
    for (const col of hoja.columnas) {
      const idx = encHeader.get(col.encabezado)
      const bruto = idx ? row.getCell(idx).value : undefined
      const valor = coaccionar(col, bruto, ubic, errores)
      if (col.requerido && valor === undefined) {
        errores.push({ ...ubic, columna: col.encabezado, codigo: 'FALTA_REQUERIDO', mensaje: `"${col.encabezado}" es obligatorio.` })
      }
      // Guardar por `campo` (si mapea) — columnas informativas se descartan.
      if (col.campo && valor !== undefined) valores[col.campo] = valor
    }
    filas.push({ fila: r, valores })
  }
  return { hoja: hoja.hoja, filas, errores }
}

export async function parsearLibro(rutaOBuffer: string | Buffer, hojas: HojaSpec[]): Promise<ResultadoParseo> {
  const wb = new ExcelJS.Workbook()
  if (typeof rutaOBuffer === 'string') await wb.xlsx.readFile(rutaOBuffer)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Buffer de Node vs ExcelJS.Buffer (mismatch de tipos, compatible en runtime)
  else await wb.xlsx.load(rutaOBuffer as any)

  const erroresGlobales: ErrorFila[] = []
  const resultado: Record<string, ResultadoHoja> = {}
  for (const hoja of hojas) {
    resultado[hoja.hoja] = parsearHoja(wb.getWorksheet(hoja.hoja), hoja, erroresGlobales)
  }
  return { hojas: resultado, errores: erroresGlobales }
}

/**
 * Verifica FKs INTERNAS (referencias a códigos de otra hoja del mismo archivo)
 * y duplicados de código dentro de cada hoja. No cubre FKs externas (maestros ya
 * existentes en BD) ni unicidad contra la base — eso lo hace el orquestador.
 */
export function validarReferenciasInternas(parseo: ResultadoParseo, hojas: HojaSpec[]): ErrorFila[] {
  const errores: ErrorFila[] = []
  const codigosPorHoja: Record<string, Set<string>> = {}
  for (const hoja of hojas) {
    const set = new Set<string>()
    const vistos = new Set<string>()
    // Sólo detectar duplicados cuando el código es único por hoja (no cuando lo
    // es por un padre, ej. Predio.codigo único por productor).
    const chequearDup = hoja.codigoUnicoGlobal !== false
    for (const fila of parseo.hojas[hoja.hoja]?.filas ?? []) {
      const cod = fila.valores['codigo']
      if (typeof cod === 'string') {
        if (chequearDup && vistos.has(cod)) {
          errores.push({ hoja: hoja.hoja, fila: fila.fila, columna: 'Código', codigo: 'CODIGO_DUPLICADO', mensaje: `Código "${cod}" repetido en la hoja.` })
        }
        vistos.add(cod)
        set.add(cod)
      }
    }
    codigosPorHoja[hoja.hoja] = set
  }

  for (const hoja of hojas) {
    // Solo FKs internas (resuelven contra el propio archivo). Las marcadas
    // `externo` referencian maestros que ya existen en BD (aunque tengan `hoja`
    // para el dropdown) y se resuelven en el commit, no acá.
    const fkCols = hoja.columnas.filter((c) => c.tipo === 'fk' && c.fk?.hoja && !c.fk?.externo && c.campo)
    for (const fila of parseo.hojas[hoja.hoja]?.filas ?? []) {
      for (const col of fkCols) {
        const val = fila.valores[col.campo!]
        if (typeof val === 'string' && !codigosPorHoja[col.fk!.hoja!]?.has(val)) {
          errores.push({
            hoja: hoja.hoja,
            fila: fila.fila,
            columna: col.encabezado,
            codigo: 'FK_NO_RESUELTA',
            mensaje: `No existe el código "${val}" en la hoja "${col.fk!.hoja}".`,
          })
        }
      }
    }
  }
  return errores
}
