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
  embarque: { id: number; numeroInstructivo: string; notaVentaId?: number }
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
  fechaDocumento: string | null
  estado: EstadoProforma
  fechaEmision: string
  lineas: ProformaLinea[]
}

export interface ProformaEmitirInput {
  dimensiones: DimensionProforma[]
  idioma: string
  fechaDocumento?: string | null
  lineas: ProformaLineaInput[]
  montoFlete?: number | null
  montoSeguro?: number | null
}

// Respuesta del endpoint de sugerencia de líneas: incluye la cláusula de venta
// del Embarque para decidir si se piden Flete/Seguro, la nota de venta (para el
// link al Cierre Comercial) y los mantenedores sin descripción extranjera.
export interface ProformaSugerenciaResponse {
  data: ProformaLineaSugerida[]
  clausula: ClausulaVentaFlags | null
  notaVentaId: number | null
  faltantesExtranjera: string[]
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

export type EstadoFacturaExportacion = 'BORRADOR' | 'APROBADA' | 'RECHAZADA' | 'ANULADA'

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
    notaVentaId?: number
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
  idioma: string
  fechaDocumento: string | null
  montoTotal: string
  montoFlete: string | null
  montoSeguro: string | null
  // Tipo de cambio (pesos por unidad de la moneda extranjera) y fecha de la
  // paridad observada. Null cuando la moneda es la base (CLP) o no se capturó.
  tipoCambio: string | null
  fechaTipoCambio: string | null
  estado: EstadoFacturaExportacion
  errorMensajeSii: string | null
  fechaEmision: string | null
  tipoDte: number
  folio: number | null
  trackIdSii: string | null
  lineas: FacturaExportacionLinea[]
  cuotas: FacturaExportacionCuota[]
  // Estado del DocumentoDte (solo en el detalle) — habilita Enviar/Firmar/XML.
  dte?: { estado: string; folio: number | null; tieneXml: boolean } | null
}

// Fila del listado embarque-céntrico (landing de Exportación).
export interface EmbarqueExportacionRow {
  id: number
  numeroInstructivo: string
  despachadoEn: string | null
  notaVenta: { clienteId: number; cliente: { id: number; razonSocial: string } } | null
  proformas: { id: number; codigo: string; estado: EstadoProforma }[]
  facturasExportacion: { id: number; codigo: string; estado: EstadoFacturaExportacion; folio: number | null }[]
}

export interface EmbarquesExportacionListResponse {
  data: EmbarqueExportacionRow[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface FacturaExportacionActualizarInput {
  dimensiones: DimensionProforma[]
  lineas: ProformaLineaInput[]
  idioma?: 'ES' | 'EN'
  fechaDocumento?: string | null
  montoFlete?: number | null
  montoSeguro?: number | null
  tipoCambio?: number | null
  // Fecha de la paridad observada (ISO YYYY-MM-DD) cuando viene de "Obtener";
  // null en ingreso manual. BRT-R1-003.
  fechaTipoCambio?: string | null
}

// Respuesta del endpoint de tipo de cambio sugerido (dólar/euro observado).
export interface TipoCambioSugerido {
  valor: number
  fecha: string
  moneda: string
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
