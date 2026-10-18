// Factura Nacional (DTE 33 Afecta / 34 Exenta). Primera entrega: origen =
// Proforma de Materiales. Ver Docs/cobranza.md (supersesión Factura Nacional).

export type EstadoFacturaNacional = 'BORRADOR' | 'APROBADA' | 'RECHAZADA' | 'ANULADA'
export type OrigenFacturaNacional = 'PROFORMA_MATERIAL' | 'PROFORMA_PRODUCTOR' | 'VENTA_NACIONAL'

export const ESTADO_FN_LABELS: Record<EstadoFacturaNacional, string> = {
  BORRADOR: 'Borrador',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  ANULADA: 'Anulada',
}

export const ORIGEN_FN_LABELS: Record<OrigenFacturaNacional, string> = {
  PROFORMA_MATERIAL: 'Proforma de Materiales',
  PROFORMA_PRODUCTOR: 'Proforma de Productor',
  VENTA_NACIONAL: 'Venta Nacional',
}

interface MantenedorRef {
  id: number
  codigo: string
  descripcion: string
}

export interface FacturaNacionalLinea {
  id: number
  descripcion: string
  articuloId: number | null
  articulo: MantenedorRef | null
  cantidad: string
  precioUnitario: string // CLP (convertido en VENTA_NACIONAL)
  precioUnitarioOrigen: string | null // USD (VENTA_NACIONAL)
  exento: boolean
  montoLinea: string
}

// Línea editable en el borrador (lo que se envía en el PATCH). En VENTA_NACIONAL
// `precioUnitario` es el precio de ORIGEN (USD); el backend lo convierte a CLP.
export interface FacturaNacionalLineaInput {
  descripcion: string
  articuloId?: number | null
  cantidad: number
  precioUnitario: number
  exento: boolean
}

export interface FacturaNacionalClienteRef {
  id: number
  codigo: string
  descripcion: string
  razonSocial: string | null
  identificador: string | null
  giro: string | null
  tipos: string[]
  direcciones: { direccion: string | null; comuna: { descripcion: string } | null }[]
}

// Estado del DocumentoDte asociado (solo en el detalle) — habilita Enviar/Firmar/XML.
export interface FacturaNacionalDteEstado {
  estado: string
  folio: number | null
  tieneXml: boolean
}

export interface FacturaNacional {
  id: number
  origenClase: OrigenFacturaNacional
  proformaMaterialId: number | null
  proformaMaterial: { id: number; numero: string; estado: string } | null
  embarqueId: number | null
  embarque: { id: number; numeroInstructivo: string; notaVenta: { moneda: { codigo: string } } } | null
  tipoCambio: string | null
  fechaTipoCambio: string | null
  codigo: string
  clienteId: number
  cliente: FacturaNacionalClienteRef
  monedaId: number
  moneda: MantenedorRef & { esMonedaBase: boolean }
  condicionPagoId: number | null
  condicionPago: MantenedorRef | null
  montoNeto: string
  montoExento: string
  montoIva: string
  montoTotal: string
  idioma: string
  estado: EstadoFacturaNacional
  fechaDocumento: string | null
  fechaEmision: string | null
  observaciones: string | null
  errorMensajeSii: string | null
  tipoDte: number
  folio: number | null
  trackIdSii: string | null
  actualizadoEn: string | null
  creadoEn: string
  lineas: FacturaNacionalLinea[]
  // Solo en el detalle (obtenerFactura).
  dte?: FacturaNacionalDteEstado | null
}

export interface FacturaNacionalActualizarInput {
  fechaDocumento?: string | null
  observaciones?: string | null
  tipoCambio?: number | null
  fechaTipoCambio?: string | null
  lineas?: FacturaNacionalLineaInput[]
}

// Embarque de venta NACIONAL disponible para facturar (despachado, sin factura).
export interface EmbarqueFacturable {
  id: number
  numeroInstructivo: string
  despachadoEn: string | null
  notaVenta: { folio: number; cliente: { id: number; razonSocial: string | null } }
}

export interface EmbarquesFacturablesResponse {
  data: EmbarqueFacturable[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface TipoCambioSugerido {
  valor: number
  fecha: string
  moneda: string
}

export interface FacturasNacionalListFilters {
  page?: number
  limit?: number
  estado?: EstadoFacturaNacional
  q?: string
}

export interface FacturasNacionalListResponse {
  data: FacturaNacional[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

// Proforma de Materiales disponible para facturar (ENVIADA_VALIDACION, sin
// Factura Nacional activa).
export interface ProformaFacturable {
  id: number
  numero: string
  entidad: { id: number; razonSocial: string | null }
  moneda: MantenedorRef
  _count: { lineas: number }
  creadoEn: string
}

export interface ProformasFacturablesResponse {
  data: ProformaFacturable[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}
