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

// Flags de la cláusula de venta (Incoterm) que exigen Flete/Seguro.
export interface ClausulaVentaFlags {
  descripcion: string
  requiereFlete: boolean
  requiereSeguro: boolean
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
  montoFlete: string | null
  montoSeguro: string | null
  estado: EstadoProforma
  fechaEmision: string
  lineas: ProformaLinea[]
}

export interface ProformaEmitirInput {
  dimensiones: DimensionProforma[]
  idioma: string
  lineas: ProformaLineaInput[]
  montoFlete?: number | null
  montoSeguro?: number | null
}

// Respuesta del endpoint de sugerencia de líneas: incluye la cláusula de venta
// del Embarque para decidir si se piden Flete/Seguro.
export interface ProformaSugerenciaResponse {
  data: ProformaLineaSugerida[]
  clausula: ClausulaVentaFlags | null
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

// ─── Factura de Exportación (DTE 110) ────────────────────────────────────────

export type EstadoFacturaExportacion = 'BORRADOR' | 'EMITIDA' | 'ANULADA'

export interface FacturaExportacionLinea {
  id: number
  descripcion: string
  especieId: number
  variedadId: number | null
  articuloId: number | null
  calibreId: number | null
  categoriaId: number | null
  etiquetaId: number | null
  cantidadCajas: number
  precioUnitario: string
  montoLinea: string
}

export interface FacturaExportacionCuota {
  id: number
  numeroCuota: number
  fechaReferencia: 'FACTURA' | 'ZARPE' | 'ENVIO_DOCUMENTOS' | 'ARRIBO'
  plazoDias: number
  montoCuota: string
  fechaVencimiento: string | null
  estado: string
}

export interface FacturaExportacion {
  id: number
  codigo: string
  embarqueId: number
  embarque: {
    id: number
    numeroInstructivo: string
    notaVenta: { clausulaVenta: ClausulaVentaFlags | null }
  }
  proformaId: number
  proforma: { id: number; codigo: string } | null
  clienteId: number
  cliente: MantenedorRef
  monedaId: number
  moneda: MantenedorRef
  condicionPagoId: number | null
  condicionPago: MantenedorRef | null
  dimensionesAgrupacion: DimensionProforma[]
  montoTotal: string
  montoFlete: string | null
  montoSeguro: string | null
  estado: EstadoFacturaExportacion
  fechaEmision: string | null
  tipoDte: number
  folio: number | null
  trackIdSii: string | null
  lineas: FacturaExportacionLinea[]
  cuotas: FacturaExportacionCuota[]
}

export interface FacturaExportacionActualizarInput {
  dimensiones: DimensionProforma[]
  lineas: ProformaLineaInput[]
  montoFlete?: number | null
  montoSeguro?: number | null
}

export interface FacturasExportacionListFilters {
  page?: number
  limit?: number
  embarqueId?: number
  clienteId?: number
  estado?: EstadoFacturaExportacion
  folio?: string
}

export interface FacturasExportacionListResponse {
  data: FacturaExportacion[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export const FECHA_REFERENCIA_LABELS: Record<FacturaExportacionCuota['fechaReferencia'], string> = {
  FACTURA: 'Factura',
  ZARPE: 'Zarpe',
  ENVIO_DOCUMENTOS: 'Envío de documentos',
  ARRIBO: 'Arribo',
}
