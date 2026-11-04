// Generador DTE — documentos manuales (2026-11-04). Tipos del módulo.
export type ClaseDocumentoManual = 'FACTURA_NACIONAL' | 'GUIA_DESPACHO' | 'NOTA_CREDITO' | 'NOTA_DEBITO'
export type EstadoDocumentoManual = 'BORRADOR' | 'ENVIADA_SII' | 'APROBADA' | 'RECHAZADA' | 'ANULADA'

export interface DocumentoManualLineaInput {
  descripcion: string
  articuloId?: number | null
  cantidad: number
  precioUnitario: number
  exento: boolean
}

export interface DocumentoManualReferenciaInput {
  tipoDocRef: string
  folioRef: string
  fechaRef: string // ISO date
  codRef?: number | null
  razonRef?: string | null
  refOrigenTipo?: string | null
  refOrigenId?: number | null
}

export interface DocumentoManualTransporteInput {
  indTraslado: number
  transporteId?: number | null
  choferChileno: boolean
  choferRut?: string | null
  choferNombre?: string | null
  patenteCamion?: string | null
  patenteRemolque?: string | null
  dirOrigen?: string | null
  comunaOrigen?: string | null
  dirDestino?: string | null
  comunaDestino?: string | null
}

export interface DocumentoManualCreateInput {
  claseDocumento: ClaseDocumentoManual
  entidadId: number
  monedaId: number
  tipoCambio?: number | null
  fechaDocumento: string // ISO date
  condicionPagoId?: number | null
  idioma?: string
  observaciones?: string | null
  transporte?: DocumentoManualTransporteInput | null
  referencias?: DocumentoManualReferenciaInput[]
  lineas: DocumentoManualLineaInput[]
}

export type DocumentoManualUpdateInput = Partial<DocumentoManualCreateInput>

export interface DocumentoManualListFilters {
  page: number
  limit: number
  q?: string
  claseDocumento?: ClaseDocumentoManual
  estado?: EstadoDocumentoManual
  entidadId?: number
}
