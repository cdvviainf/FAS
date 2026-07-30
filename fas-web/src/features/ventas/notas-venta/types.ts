export interface MantenedorRef {
  id: number
  codigo: string
  descripcion: string
}

export interface CondicionPagoRef {
  id: number
  codigo: string
  descripcion: string
}

export type FechaReferenciaPago = 'FACTURA' | 'ZARPE' | 'ENVIO_DOCUMENTOS'
export type TipoValorCuota = 'PORCENTAJE' | 'MONTO_UNITARIO'

// Snapshot inmutable de las cuotas de la Forma de Pago al momento de guardar
// el Cierre Comercial (ver Docs/ventas.md R12) — no cambia si se edita la
// CondicionPago después. `montoCalculado` (cuotas MONTO_UNITARIO) sí se
// recalcula cada vez que se agrega un detalle nuevo, para reflejar la fruta
// comprometida real.
export interface NotaVentaCuotaPagoRef {
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

export interface NotaVentaDetalleItem {
  id: number
  notaVentaId: number
  fechaCompromiso: string
  especieId: number
  especie: MantenedorRef
  variedadId: number
  variedad: MantenedorRef
  articuloId: number
  articulo: MantenedorRef & { etiqueta: string | null; kgNetoEnvase: string | null; kgBrutoEnvase: string | null }
  categoriaId: number | null
  categoria: MantenedorRef | null
  tipoPalletId: number | null
  tipoPallet: MantenedorRef | null
  cantidadPallets: number
  cajasPorPallet: number
  cajas: number
  precio: string
  calibres: { calibre: MantenedorRef }[]
}

export interface NotaVentaListItem {
  id: number
  folio: number
  fecha: string
  clienteId: number
  cliente: { id: number; codigo: string; descripcion: string; razonSocial: string }
  mercado: MantenedorRef
  moneda: MantenedorRef
}

export interface NotaVentaDetalle extends NotaVentaListItem {
  compradorId: number | null
  comprador: { id: number; codigo: string; descripcion: string; razonSocial: string } | null
  notifyId: number | null
  notify: { id: number; codigo: string; descripcion: string; razonSocial: string } | null
  clienteFinalId: number | null
  clienteFinal: { id: number; codigo: string; descripcion: string; razonSocial: string } | null
  tipoEmbarqueId: number
  tipoEmbarque: MantenedorRef
  mercadoId: number
  paisDestinoId: number
  paisDestino: MantenedorRef
  puertoDestinoId: number | null
  puertoDestino: MantenedorRef | null
  direccionId: number | null
  direccion: { id: number; codigo: string; direccion: string } | null
  direccionDetalle: string | null
  monedaId: number
  modalidadVentaId: number | null
  modalidadVenta: MantenedorRef | null
  clausulaVentaId: number | null
  clausulaVenta: MantenedorRef | null
  tipoFleteId: number | null
  tipoFlete: MantenedorRef | null
  condicionPagoId: number | null
  condicionPago: CondicionPagoRef | null
  cuotasPago: NotaVentaCuotaPagoRef[]
  observaciones: string | null
  detalles: NotaVentaDetalleItem[]
}

export interface NotaVentaListResponse {
  data: NotaVentaListItem[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface NotaVentaCreateInput {
  fecha: string
  clienteId: number
  compradorId?: number | null
  notifyId?: number | null
  clienteFinalId?: number | null
  tipoEmbarqueId: number
  mercadoId: number
  paisDestinoId: number
  puertoDestinoId?: number | null
  direccionId?: number | null
  direccionDetalle?: string | null
  monedaId: number
  modalidadVentaId?: number | null
  clausulaVentaId?: number | null
  tipoFleteId?: number | null
  condicionPagoId?: number | null
  observaciones?: string | null
}

export type NotaVentaUpdateInput = Partial<NotaVentaCreateInput>

export interface NotaVentaDetalleCreateInput {
  fechaCompromiso: string
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
