export type DimensionProforma = 'VARIEDAD' | 'ARTICULO' | 'CALIBRE' | 'CATEGORIA' | 'MARCA'
export type EstadoProforma = 'EMITIDA' | 'ANULADA'

export const DIMENSION_LABELS: Record<DimensionProforma, string> = {
  VARIEDAD: 'Variedad',
  ARTICULO: 'Artículo',
  CALIBRE: 'Calibre',
  CATEGORIA: 'Categoría',
  MARCA: 'Marca',
}

interface MantenedorRef {
  id: number
  codigo: string
  descripcion: string
}

export interface ProformaLineaSugerida {
  descripcion: string
  especieId: number
  variedadId: number | null
  articuloId: number | null
  calibreId: number | null
  categoriaId: number | null
  etiquetaId: number | null
  cantidadCajas: number
  montoLinea: number
  precioUnitario: number
}

export interface ProformaLineaInput {
  descripcion: string
  especieId: number
  variedadId?: number | null
  articuloId?: number | null
  calibreId?: number | null
  categoriaId?: number | null
  etiquetaId?: number | null
  cantidadCajas: number
  precioUnitario: number
}

export interface ProformaLinea {
  id: number
  descripcion: string
  cantidadCajas: number
  precioUnitario: string
  montoLinea: string
}

export interface Proforma {
  id: number
  codigo: string
  embarqueId: number
  embarque: { id: number; numeroInstructivo: string }
  clienteId: number
  cliente: MantenedorRef
  monedaId: number
  moneda: MantenedorRef
  condicionPagoId: number | null
  condicionPago: MantenedorRef | null
  idioma: string
  montoTotal: string
  estado: EstadoProforma
  fechaEmision: string
  lineas: ProformaLinea[]
}

export interface ProformaEmitirInput {
  dimensiones: DimensionProforma[]
  idioma: string
  lineas: ProformaLineaInput[]
}

export interface ProformasListFilters {
  page?: number
  limit?: number
  embarqueId?: number
  clienteId?: number
  estado?: EstadoProforma
  folio?: string
}

export interface ProformasListResponse {
  data: Proforma[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}
