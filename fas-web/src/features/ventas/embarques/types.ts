export interface EmbarqueNotaVentaRef {
  id: number
  folio: number
}

export interface MantenedorRef {
  id: number
  codigo: string
  descripcion: string
}

export interface EntidadRef {
  id: number
  codigo: string
  descripcion: string
}

// Origen de un Pallet (compras.md §4.4/§4.5) — de qué OC (modo COMPRA) o de
// qué Instructivo(s) de Embalaje (modo PROCESO) viene, para la trazabilidad
// Cierre Comercial ↔ Embarque ↔ Pallet (2026-09-02).
export interface PalletOrigenRecepcion {
  ordenCompra: { id: number; numero: string } | null
  instructivos: Array<{ instructivo: { id: number; numero: number } }>
}

export interface PalletLineaResumen {
  especieId: number
  especie: MantenedorRef
  variedadId: number
  variedad: MantenedorRef
  categoriaId: number
  categoria: MantenedorRef
  articuloId: number
  articulo: MantenedorRef
  calibreId: number
  calibre: MantenedorRef
  cajas: number
}

export interface PalletResumen {
  id: number
  numeroPallet: string
  origen: 'COMPRA' | 'CONSIGNACION' | 'PROCESO'
  productor: EntidadRef
  recepcion: PalletOrigenRecepcion
  lineas: PalletLineaResumen[]
}

// Estado de la Solicitud de Reserva con AGL360 (ventas.md §4.3, 2026-09-05).
export type EstadoReservaEmbarque = 'PENDIENTE' | 'SOLICITADA' | 'CONFIRMADA'

export const ESTADO_RESERVA_LABELS: Record<EstadoReservaEmbarque, string> = {
  PENDIENTE: 'Pendiente',
  SOLICITADA: 'Solicitada',
  CONFIRMADA: 'Confirmada',
}

export interface SolicitudReserva {
  id: number
  referenciaFas: string
  numeroBooking: string | null
  naviera: string | null
  nave: string | null
  numeroContenedor: string | null
  fechaZarpe: string | null
  fechaRetiroPlanta: string | null
  enviadoEn: string
  confirmadoEn: string | null
}

export interface Embarque {
  id: number
  notaVentaId: number
  notaVenta: EmbarqueNotaVentaRef
  numeroInstructivo: string
  estadoReserva: EstadoReservaEmbarque
  despachadoEn: string | null
  despachadoPor: string | null
  creadoEn: string
  _count: { pallets: number }
}

export interface EmbarqueDetalle extends Omit<Embarque, '_count'> {
  pallets: PalletResumen[]
  solicitudReserva: SolicitudReserva | null
}

// numeroInstructivo ya no se ingresa manualmente (2026-08-13, ventas.md R10):
// se calcula en el backend a partir del folio de la NV y el prefijo
// configurado para su Tipo de Embarque.
export interface EmbarqueCreateInput {
  notaVentaId: number
  forzarSinReserva?: boolean
}

export interface EmbarqueListResponse {
  data: Embarque[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}
