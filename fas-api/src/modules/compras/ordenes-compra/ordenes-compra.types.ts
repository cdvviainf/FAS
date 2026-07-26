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

export interface OrdenCompraCreateInput {
  entidadProductorId: number
  notaVentaId?: number | null
  fecha?: Date
  fechaEntregaDesde?: string | null
  fechaEntregaHasta?: string | null
  formaPagoId?: number | null
  condicionPagoId?: number | null
  monedaId: number
  incotermId?: number | null
  destinoMercadoId?: number | null
  responsableId?: string | null
  observaciones?: string | null
  lineas: OrdenCompraLineaInput[]
}

export type OrdenCompraUpdateInput = Partial<Omit<OrdenCompraCreateInput, 'lineas'>> & {
  estado?: 'BORRADOR' | 'EMITIDA' | 'RECEPCIONADA'
  lineas?: OrdenCompraLineaInput[]
}
