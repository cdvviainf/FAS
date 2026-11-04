// Generador DTE — documentos manuales (2026-11-04). Tipos del feature FE.
export type ClaseDocumentoManual = 'FACTURA_NACIONAL' | 'GUIA_DESPACHO' | 'NOTA_CREDITO' | 'NOTA_DEBITO'
export type EstadoDocumentoManual = 'BORRADOR' | 'ENVIADA_SII' | 'APROBADA' | 'RECHAZADA' | 'ANULADA'

export const CLASE_LABELS: Record<ClaseDocumentoManual, string> = {
  FACTURA_NACIONAL: 'Factura Nacional',
  GUIA_DESPACHO: 'Guía de Despacho',
  NOTA_CREDITO: 'Nota de Crédito',
  NOTA_DEBITO: 'Nota de Débito',
}

export const ESTADO_LABELS: Record<EstadoDocumentoManual, string> = {
  BORRADOR: 'Borrador',
  ENVIADA_SII: 'Enviada al SII',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  ANULADA: 'Anulada',
}

// Tipos de traslado SII para la Guía de Despacho (DTE 52).
export const IND_TRASLADO_OPCIONES: { value: number; label: string }[] = [
  { value: 1, label: 'Venta' },
  { value: 2, label: 'Venta por efectuar' },
  { value: 3, label: 'Consignación' },
  { value: 4, label: 'Entrega gratuita' },
  { value: 5, label: 'Traslado interno' },
  { value: 6, label: 'Otros traslados no venta' },
  { value: 7, label: 'Guía de devolución' },
  { value: 8, label: 'Traslado para exportación' },
  { value: 9, label: 'Venta para exportación' },
]

export const COD_REF_OPCIONES: { value: number; label: string }[] = [
  { value: 1, label: 'Anula documento' },
  { value: 2, label: 'Corrige texto' },
  { value: 3, label: 'Corrige monto' },
]

interface MantenedorRef {
  id: number
  codigo: string
  descripcion: string
}

export interface EntidadRef {
  id: number
  codigo: string
  descripcion: string
  razonSocial: string
  identificador?: string | null
}

export interface DocumentoManualLineaInput {
  descripcion: string
  articuloId?: number | null
  cantidad: number
  precioUnitario: number
  exento: boolean
}

export interface DocumentoManualLineaItem {
  id: number
  descripcion: string
  articuloId: number | null
  articulo: MantenedorRef | null
  cantidad: string
  precioUnitario: string
  exento: boolean
  montoLinea: string
  orden: number
}

export interface DocumentoManualReferenciaInput {
  tipoDocRef: string
  folioRef: string
  fechaRef: string
  codRef?: number | null
  razonRef?: string | null
  refOrigenTipo?: string | null
  refOrigenId?: number | null
}

export interface DocumentoManualReferenciaItem extends DocumentoManualReferenciaInput {
  id: number
  orden: number
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
  fechaDocumento: string
  condicionPagoId?: number | null
  idioma?: 'ES' | 'EN'
  observaciones?: string | null
  transporte?: DocumentoManualTransporteInput | null
  referencias?: DocumentoManualReferenciaInput[]
  lineas: DocumentoManualLineaInput[]
}

export type DocumentoManualUpdateInput = Partial<Omit<DocumentoManualCreateInput, 'claseDocumento'>>

export interface DocumentoManualListItem {
  id: number
  codigo: string
  claseDocumento: ClaseDocumentoManual
  tipoDte: number
  estado: EstadoDocumentoManual
  fechaDocumento: string
  montoTotal: string
  moneda: MantenedorRef
  entidad: EntidadRef
}

export interface DocumentoManualDetalle {
  id: number
  codigo: string
  claseDocumento: ClaseDocumentoManual
  tipoDte: number
  estado: EstadoDocumentoManual
  fechaDocumento: string
  entidadId: number
  entidad: EntidadRef
  monedaId: number
  moneda: MantenedorRef
  tipoCambio: string | null
  condicionPagoId: number | null
  condicionPago: MantenedorRef | null
  idioma: string
  observaciones: string | null
  montoNeto: string
  montoExento: string
  montoIva: string
  montoTotal: string
  // Transporte (guía)
  guiaIndTraslado: number | null
  guiaTransporteId: number | null
  guiaTransporte: EntidadRef | null
  guiaChoferRut: string | null
  guiaChoferChileno: boolean
  guiaChoferNombre: string | null
  guiaPatenteCamion: string | null
  guiaPatenteRemolque: string | null
  guiaDirOrigen: string | null
  guiaComunaOrigen: string | null
  guiaDirDestino: string | null
  guiaComunaDestino: string | null
  lineas: DocumentoManualLineaItem[]
  referencias: DocumentoManualReferenciaItem[]
}

export interface DocumentoManualListResponse {
  data: DocumentoManualListItem[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface DocumentoManualListFilters {
  q?: string
  page?: number
  limit?: number
  claseDocumento?: ClaseDocumentoManual
  estado?: EstadoDocumentoManual
  entidadId?: number
}
