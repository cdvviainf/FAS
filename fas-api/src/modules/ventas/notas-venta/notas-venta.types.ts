import type { ParCalidad } from '../../../shared/calidades-permitidas.js'

export type TipoVenta = 'EXPORTACION' | 'NACIONAL'

export interface NotaVentaCreateInput {
  fecha: Date
  tipoVenta?: TipoVenta
  clienteId: number
  exportadorId?: number | null
  // Calidades permitidas = pares (NotaCalidad, NotaCondicion). Restringen qué
  // pallets se pueden reservar en el Embarque de este Cierre.
  calidadesPermitidas?: ParCalidad[]
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
  monedaId: number
  observaciones?: string | null
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
}

export type NotaVentaDetalleUpdateInput = NotaVentaDetalleCreateInput
