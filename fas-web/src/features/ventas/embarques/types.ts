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
  planta: EntidadRef
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
  articulo: MantenedorRef & { kgNetoEnvase: string | null }
  calibreId: number
  calibre: MantenedorRef
  cajas: number
  // Antigüedad del Pallet en Seleccionar Pallets = la mayor entre sus líneas
  // (compras.md §4.10) — null en PalletLinea históricas, cae a Pallet.creadoEn.
  fechaEmbalaje: string | null
}

export interface PalletResumen {
  id: number
  numeroPallet: string
  origen: 'COMPRA' | 'CONSIGNACION' | 'PROCESO'
  creadoEn: string
  productor: EntidadRef
  notaCalidadId: number | null
  notaCalidad: MantenedorRef | null
  notaCondicionId: number | null
  notaCondicion: MantenedorRef | null
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

// Datos de booking tipeados a mano (2026-09-07, ventas.md §4.3 — Gestor
// Logístico sin integración, o "Dejar Manual" tras un fallo de AGL360).
// `navieraManual` (texto libre) salió de acá (2026-09-21) — pasó a
// `navieraId` en DatosInstructivo, compartido con el Instructivo de Embarque.
export interface DatosReservaManual {
  numeroBookingManual: string | null
  naveManual: string | null
  numeroContenedorManual: string | null
  fechaZarpeManual: string | null
  fechaRetiroPlantaManual: string | null
}

export interface DatosReservaManualInput {
  numeroBooking?: string | null
  nave?: string | null
  numeroContenedor?: string | null
  fechaZarpe?: string | null
  fechaRetiroPlanta?: string | null
}

// Instructivo de Embarque (2026-09-21, ventas.md R11 + gap analysis) —
// campos compartidos por todo el Embarque, independientes de reservaManual.
export interface DatosInstructivo {
  puertoZarpeId: number | null
  puertoZarpe: MantenedorRef | null
  voyageNumber: string | null
  deposito: string | null
  awbBl: string | null
  cutoffDate: string | null
  tipoBultos: string | null
  agenteAduanaId: number | null
  agenteAduana: EntidadRef | null
  embarcadorId: number | null
  embarcador: EntidadRef | null
  navieraId: number | null
  naviera: EntidadRef | null
}

export interface DatosInstructivoInput {
  puertoZarpeId?: number | null
  voyageNumber?: string | null
  deposito?: string | null
  awbBl?: string | null
  cutoffDate?: string | null
  tipoBultos?: string | null
  agenteAduanaId?: number | null
  embarcadorId?: number | null
  navieraId?: number | null
}

// Hitos por Planta/punto de retiro (ventas.md R11) — generados vía el botón
// "Generar Instructivos", nunca creados a mano.
export interface InstructivoHijo {
  id: number
  codigo: string
  secuencia: number
  plantaId: number
  planta: EntidadRef
  fechaCargaPlanta: string | null
  stackingDesde: string | null
  stackingHasta: string | null
  observaciones: string | null
}

export interface InstructivoHijoUpdateInput {
  fechaCargaPlanta?: string | null
  stackingDesde?: string | null
  stackingHasta?: string | null
  observaciones?: string | null
}

export interface Embarque extends DatosReservaManual, DatosInstructivo {
  id: number
  notaVentaId: number
  notaVenta: EmbarqueNotaVentaRef
  numeroInstructivo: string
  // Nullable (2026-09-07, IMP-QA-R1-014): Embarques creados antes de este
  // campo (o vía fixtures de test que insertan directo por Prisma) no
  // tienen gestor — la API/UI debe tratarlo como legacy, nunca asumir que
  // siempre existe.
  gestorLogisticoId: number | null
  gestorLogistico: EntidadRef | null
  estadoReserva: EstadoReservaEmbarque
  reservaManual: boolean
  despachadoEn: string | null
  despachadoPor: string | null
  creadoEn: string
  _count: { pallets: number }
}

// Reconciliación de Packing List (compras.md §9.3, cierra EP-QA-003) — a lo
// más una por Embarque, cada subida nueva reemplaza la anterior.
export type EstadoPackingList = 'OK' | 'DISCREPANCIA'

export interface PackingListEmbarque {
  id: number
  templateCargaId: number
  nombreArchivo: string
  mime: string
  tamano: number
  estado: EstadoPackingList
  discrepancias: string[]
  cargadoEn: string
  cargadoPor: string
}

export interface EmbarqueDetalle extends Omit<Embarque, '_count'> {
  pallets: PalletResumen[]
  solicitudReserva: SolicitudReserva | null
  instructivosHijos: InstructivoHijo[]
  packingList: PackingListEmbarque | null
}

// numeroInstructivo ya no se ingresa manualmente (2026-08-13, ventas.md R10):
// se calcula en el backend a partir del folio de la NV y el prefijo
// configurado para su Tipo de Embarque. gestorLogisticoId (2026-09-07,
// ventas.md §4.3) se elige junto al resto — determina si se intenta la
// reserva automática o si el Embarque nace en modo manual.
export interface EmbarqueCreateInput {
  notaVentaId: number
  gestorLogisticoId: number
  forzarSinReserva?: boolean
}

export interface EmbarqueListResponse {
  data: Embarque[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}
