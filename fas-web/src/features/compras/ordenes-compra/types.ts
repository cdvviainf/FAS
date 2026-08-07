export interface MantenedorRef {
  id: number
  codigo: string
  descripcion: string
}

export interface EntidadRef {
  id: number
  codigo: string
  descripcion: string
  razonSocial: string
}

export interface UsuarioRef {
  id: string
  nombre: string
  email: string
}

export type EstadoOrdenCompra = 'BORRADOR' | 'EMITIDA' | 'RECEPCIONADA'

export const ESTADO_OC_LABELS: Record<EstadoOrdenCompra, string> = {
  BORRADOR: 'Borrador',
  EMITIDA: 'Emitida',
  RECEPCIONADA: 'Recepcionada',
}

export interface OrdenCompraLineaItem {
  id: number
  especieId: number
  especie: MantenedorRef
  variedadId: number
  variedad: MantenedorRef
  categoriaId: number
  categoria: MantenedorRef
  articuloId: number
  articulo: MantenedorRef & { etiqueta: string | null; kgNetoEnvase: string | null; kgBrutoEnvase: string | null }
  calibreMinId: number
  calibreMin: MantenedorRef
  calibreMaxId: number
  calibreMax: MantenedorRef
  tipoPalletId: number | null
  tipoPallet: MantenedorRef | null
  cantidadPallets: number
  cajasPorPallet: number
  cajas: number
  precioUsdCaja: string
}

export type FechaReferenciaPago = 'FACTURA' | 'ZARPE' | 'ENVIO_DOCUMENTOS'
export type TipoValorCuota = 'PORCENTAJE' | 'MONTO_UNITARIO'

export interface OrdenCompraCuotaPagoItem {
  id: number
  fechaReferencia: FechaReferenciaPago
  plazoDias: number
  tipoValor: TipoValorCuota
  porcentaje: string | null
  valorUnitario: string | null
  monedaId: number | null
  moneda: MantenedorRef | null
  unidadId: number | null
  unidad: MantenedorRef | null
  montoCalculado: string | null
  descripcion: string | null
}

export interface CondicionPagoRef {
  id: number
  codigo: string
  descripcion: string
}

export interface OrdenCompraListItem {
  id: number
  numero: string
  fecha: string
  estado: EstadoOrdenCompra
  entidadProductorId: number
  entidadProductor: EntidadRef
  moneda: MantenedorRef
  notaVenta: { id: number; folio: number } | null
}

export interface OrdenCompraDetalle extends OrdenCompraListItem {
  monedaId: number
  notaVentaId: number | null
  formaPagoId: number | null
  formaPago: MantenedorRef | null
  condicionPagoId: number | null
  condicionPago: CondicionPagoRef | null
  destinoMercadoId: number | null
  destinoMercado: MantenedorRef | null
  responsableId: string | null
  responsable: UsuarioRef | null
  observaciones: string | null
  lineas: OrdenCompraLineaItem[]
  cuotasPago: OrdenCompraCuotaPagoItem[]
  creadoEn: string
  creadoPor: string
}

export interface OrdenCompraListResponse {
  data: OrdenCompraListItem[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface OrdenCompraLineaInput {
  especieId: number
  variedadId: number
  categoriaId: number
  articuloId: number
  calibreMinId: number
  calibreMaxId: number
  tipoPalletId: number | null
  cantidadPallets: number
  cajasPorPallet: number
  cajas: number
  precioUsdCaja: number
}

export interface OrdenCompraCreateInput {
  entidadProductorId: number
  notaVentaId?: number | null
  fecha?: string
  formaPagoId?: number | null
  condicionPagoId?: number | null
  monedaId: number
  destinoMercadoId?: number | null
  responsableId?: string | null
  observaciones?: string | null
}

export type OrdenCompraUpdateInput = Partial<OrdenCompraCreateInput> & {
  estado?: EstadoOrdenCompra
}

export type OrdenCompraLineaCreateInput = OrdenCompraLineaInput
