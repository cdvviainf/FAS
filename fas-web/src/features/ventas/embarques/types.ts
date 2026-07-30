export interface EmbarqueNotaVentaRef {
  id: number
  folio: number
}

export interface Embarque {
  id: number
  notaVentaId: number
  notaVenta: EmbarqueNotaVentaRef
  numeroInstructivo: string
  creadoEn: string
}

export interface EmbarqueCreateInput {
  notaVentaId: number
  numeroInstructivo: string
}
