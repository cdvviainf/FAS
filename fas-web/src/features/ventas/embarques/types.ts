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

export interface EmbarqueListResponse {
  data: Embarque[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}
