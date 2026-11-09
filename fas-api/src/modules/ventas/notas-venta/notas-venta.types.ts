export type TipoVenta = 'EXPORTACION' | 'NACIONAL'

export interface NotaVentaCreateInput {
  temporadaId?: number | null
  fecha: Date
  tipoVenta?: TipoVenta
  clienteId: number
  exportadorId?: number | null
  responsableVentaId?: string | null
  compradorContactoId?: number | null
  notifyId?: number | null
  consignatarioId?: number | null
  tipoEmbarqueId: number
  mercadoId: number
  paisDestinoId: number
  puertoDestinoId?: number | null
  direccionId?: number | null
  direccionDetalle?: string | null
  modalidadVentaId?: number | null
  clausulaVentaId?: number | null
  tipoFleteId?: number | null
  tipoBlId?: number | null
  condicionPagoId?: number | null
  formaPagoId?: number | null
  monedaId: number
  observaciones?: string | null
  contratoNaviero?: 'AGROSAN_AGL' | 'CLIENTE'
}

export type NotaVentaUpdateInput = Partial<NotaVentaCreateInput>

export interface NotaVentaDetalleCreateInput {
  fechaCompromiso: Date
  especieId: number
  variedadId: number
  articuloId: number
  // Etiqueta (Marca): opcional en el request; el service la resuelve (FIJA) o
  // exige elegirla (DINÁMICA) según el set permitido del artículo.
  etiquetaId?: number | null
  categoriaId?: number | null
  tipoPalletId?: number | null
  cantidadPallets: number
  cajasPorPallet: number
  cajas: number
  precio: number
  calibreIds: number[]
  calibreModo?: 'ESPECIFICOS' | 'RANGO'
  // Calidad / Condición "hasta" de la línea (2026-11-09): restringen qué pallets
  // se pueden reservar contra esta línea (orden <= hasta). null = sin restricción.
  notaCalidadHastaId?: number | null
  notaCondicionHastaId?: number | null
}

export type NotaVentaDetalleUpdateInput = NotaVentaDetalleCreateInput
