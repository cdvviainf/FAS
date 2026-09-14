export interface ErrorFila {
  hoja: string
  fila: number
  columna?: string
  codigo: string
  mensaje: string
}

export interface ResultadoCarga {
  dryRun: boolean
  resumen: Record<string, { filas: number; creados: number }>
  errores: ErrorFila[]
}
