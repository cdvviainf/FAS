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

// numeroInstructivo ya no se ingresa manualmente (2026-08-13, ventas.md R10):
// se calcula en el backend a partir del folio de la NV y el prefijo
// configurado para su Tipo de Embarque.
export interface EmbarqueCreateInput {
  notaVentaId: number
}

export interface EmbarqueListResponse {
  data: Embarque[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}
