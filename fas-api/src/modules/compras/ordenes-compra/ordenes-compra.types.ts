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
  fecha?: Date
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
  estado?: 'BORRADOR' | 'EMITIDA' | 'RECEPCIONADA'
  lineas?: OrdenCompraLineaInput[]
  cuotasPago?: OrdenCompraCuotaPagoInput[]
}
