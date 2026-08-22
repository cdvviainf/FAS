export interface OrdenCompraLineaInput {
  especieId: number
  variedadId: number
  categoriaId: number
  articuloId: number
  calibreIds: number[]
  tipoPalletId?: number | null
  cantidadPallets: number
  cajasPorPallet: number
  cajas: number
  precioUsdCaja: number
}

export interface OrdenCompraCreateInput {
  entidadProductorId: number
  notaVentaId?: number | null
  solicitudInspeccionIds: number[]
  fecha?: Date
  formaPagoId?: number | null
  condicionPagoId?: number | null
  monedaId: number
  destinoMercadoId?: number | null
  responsableId?: string | null
  incotermId?: number | null
  observaciones?: string | null
}

export type OrdenCompraUpdateInput = Partial<OrdenCompraCreateInput> & {
  estado?: 'BORRADOR' | 'EMITIDA' | 'RECEPCIONADA'
}

export type OrdenCompraLineaCreateInput = OrdenCompraLineaInput
export type OrdenCompraLineaUpdateInput = OrdenCompraLineaInput
