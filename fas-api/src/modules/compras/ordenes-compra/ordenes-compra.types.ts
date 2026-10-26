export interface OrdenCompraLineaInput {
  especieId: number
  variedadId: number
  articuloId: number
  // Campos de modalidad CAJAS: opcionales en el input porque no aplican en
  // GRANEL. El service los exige según la modalidad de la OC. En CAJAS la
  // etiqueta la resuelve el service si el artículo tiene etiqueta fija (2026-10-15).
  categoriaId?: number | null
  etiquetaId?: number | null
  calibreIds: number[]
  tipoPalletId?: number | null
  cantidadPallets?: number | null
  cajasPorPallet?: number | null
  cajas?: number | null
  precioUsdCaja?: number | null
  // Campos de modalidad GRANEL (2026-10-23): kilos + precio USD por kilo.
  cantidadKilos?: number | null
  precioUsdKilo?: number | null
}

export interface OrdenCompraCreateInput {
  entidadProductorId: number
  notaVentaId?: number | null
  solicitudInspeccionIds: number[]
  // Modalidad de compra (2026-10-23): CAJAS (default) o GRANEL.
  modalidad?: 'CAJAS' | 'GRANEL'
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
