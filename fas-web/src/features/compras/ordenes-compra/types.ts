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
  cantidadPallets: number
  cajasPorPallet: number
  precioUsdCaja: string
}

export interface OrdenCompraCuotaPagoItem {
  id: number
  porcentaje: string
  plazoDias: number
  descripcion: string | null
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
  formaPago: string | null
  condicionPagoTexto: string | null
  incotermId: number | null
  facturarAId: number | null
  facturarA: EntidadRef | null
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
  cantidadPallets: number
  cajasPorPallet: number
  precioUsdCaja: number
}

export interface OrdenCompraCuotaPagoInput {
  porcentaje: number
  plazoDias: number
  descripcion?: string | null
}

export interface OrdenCompraCreateInput {
  entidadProductorId: number
  notaVentaId?: number | null
  fecha?: string
  formaPago?: string | null
  condicionPagoTexto?: string | null
  monedaId: number
  incotermId?: number | null
  facturarAId?: number | null
  observaciones?: string | null
  lineas: OrdenCompraLineaInput[]
  cuotasPago?: OrdenCompraCuotaPagoInput[]
}

export type OrdenCompraUpdateInput = Partial<Omit<OrdenCompraCreateInput, 'lineas' | 'cuotasPago'>> & {
  estado?: EstadoOrdenCompra
  lineas?: OrdenCompraLineaInput[]
  cuotasPago?: OrdenCompraCuotaPagoInput[]
}
