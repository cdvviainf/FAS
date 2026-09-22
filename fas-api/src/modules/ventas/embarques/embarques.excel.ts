// Lector de Excel de Packing List (compras.md §9.2/§9.3 — cierra EP-QA-003).
// Reusa cargarPrimeraHoja()/resolverMapeoColumnas()/textoCelda() de
// recepciones.excel.ts (genéricas, sin nada específico de Recepción) en vez
// de duplicar el manejo de NBSP/rich-text/fórmula de celdas Excel — solo la
// extracción de filas crudas es propia, porque el Template PACKING_LIST
// mapea 10 columnas distintas a las de RECEPCION (sin Nota Calidad/
// Condición/Completo/Packing, ver templates-carga.types.ts).
import type ExcelJS from 'exceljs'
import { ValidationError } from '../../../shared/errors.js'
import { cargarPrimeraHoja, resolverMapeoColumnas, textoCelda } from '../../compras/recepciones/recepciones.excel.js'
import { CAMPOS_POR_TIPO } from '../../config/templates-carga/templates-carga.types.js'

export { cargarPrimeraHoja, resolverMapeoColumnas }

export interface FilaPackingListCruda {
  fila: number
  numeroPallet: string
  especie: string
  variedad: string
  categoria: string
  calibre: string
  articulo: string
  cajas: string
  productor: string
  etiqueta: string
  fechaEmbalaje: string
}

interface TemplateParaLectura {
  tieneCabecera: boolean
  filaCabecera: number | null
  filaPrimerRegistro: number
  campos: Array<{ campo: string; columna: string }>
}

const MAX_FILAS = 5000 // misma guarda de seguridad que recepciones.excel.ts

// Extracción pura, no valida contenido (esa es la Etapa 2, en el motor).
// N° de Pallet vacío = fin de la tabla de datos (mismo criterio que
// recepciones.excel.ts: filas de cierre tipo "Total"/firma no traen N° de
// Pallet propio).
export function leerFilasPackingList(
  hoja: ExcelJS.Worksheet,
  template: TemplateParaLectura,
  indicePorCampo: Map<string, number>,
): FilaPackingListCruda[] {
  const filas: FilaPackingListCruda[] = []
  let fila = template.filaPrimerRegistro
  while (fila - template.filaPrimerRegistro < MAX_FILAS) {
    const row = hoja.getRow(fila)
    const valores: Record<string, string> = {}
    for (const campo of CAMPOS_POR_TIPO.PACKING_LIST) {
      const idx = indicePorCampo.get(campo)
      valores[campo] = idx ? textoCelda(row.getCell(idx).value) : ''
    }
    if (!valores.NUMERO_PALLET) break
    filas.push({
      fila,
      numeroPallet: valores.NUMERO_PALLET,
      especie: valores.ESPECIE,
      variedad: valores.VARIEDAD,
      categoria: valores.CATEGORIA,
      calibre: valores.CALIBRE,
      articulo: valores.ARTICULO,
      cajas: valores.CAJAS,
      productor: valores.PRODUCTOR,
      etiqueta: valores.ETIQUETA,
      fechaEmbalaje: valores.FECHA_EMBALAJE,
    })
    fila++
  }

  if (filas.length === 0) {
    throw new ValidationError(`El Excel no tiene filas de datos a partir de la fila ${template.filaPrimerRegistro} configurada en el Template de Carga`)
  }
  return filas
}
