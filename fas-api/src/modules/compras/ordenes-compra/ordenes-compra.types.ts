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

export interface OrdenCompraLineaCreateInput extends OrdenCompraLineaInput {
  // Línea tomada (completa o parcial) de una línea del Cierre Comercial de
  // la propia OC (2026-08-23) — solo al crear; no se puede reasignar en un
  // PATCH (para cambiar el origen, se elimina y se vuelve a agregar).
  notaVentaDetalleId?: number | null
}
export type OrdenCompraLineaUpdateInput = OrdenCompraLineaInput
