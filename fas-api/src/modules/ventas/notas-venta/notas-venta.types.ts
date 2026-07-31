export interface NotaVentaCreateInput {
  fecha: Date
  clienteId: number
  compradorContactoId?: number | null
  notifyId?: number | null
  clienteFinalId?: number | null
  tipoEmbarqueId: number
  mercadoId: number
  paisDestinoId: number
  puertoDestinoId?: number | null
  direccionId?: number | null
  direccionDetalle?: string | null
  modalidadVentaId?: number | null
  clausulaVentaId?: number | null
  tipoFleteId?: number | null
  condicionPagoId?: number | null
  monedaId: number
  observaciones?: string | null
}

export type NotaVentaUpdateInput = Partial<NotaVentaCreateInput>

export interface NotaVentaDetalleCreateInput {
  fechaCompromiso: Date
  especieId: number
  variedadId: number
  articuloId: number
  categoriaId?: number | null
  tipoPalletId?: number | null
  cantidadPallets: number
  cajasPorPallet: number
  cajas: number
  precio: number
  calibreIds: number[]
}

export type NotaVentaDetalleUpdateInput = NotaVentaDetalleCreateInput
