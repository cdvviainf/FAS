export interface MantenedorRef {
  id: number
  codigo: string
  descripcion: string
}

// Inspección de Proceso (2026-08-21) — el Instructivo ES la inspección que
// gestiona Calidad (ver compras.md §4.1 / calidad.md). Ciclo: PENDIENTE →
// NOTIFICADA → APROBADA → CERRADA, con RECHAZADA terminal.
export type EstadoInspeccionProceso = 'PENDIENTE' | 'NOTIFICADA' | 'APROBADA' | 'RECHAZADA' | 'CERRADA'

export const ESTADO_INSPECCION_LABELS: Record<EstadoInspeccionProceso, string> = {
  PENDIENTE: 'Pendiente',
  NOTIFICADA: 'Notificada',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  CERRADA: 'Cerrada',
}

// Estados con veredicto emitido: el Instructivo queda congelado (no editable
// ni eliminable desde Compras) — mismo criterio que el backend.
export const ESTADOS_INSPECCION_CON_VEREDICTO: EstadoInspeccionProceso[] = ['APROBADA', 'RECHAZADA', 'CERRADA']

export type EstadoFolioInspeccion = 'APROBADO' | 'RECEPCIONADO'

export interface InstructivoEmbalajeFolio {
  id: number
  folio: string
  estado: EstadoFolioInspeccion
  palletId: number | null
  creadoEn: string
}

export interface EntidadRef {
  id: number
  codigo: string
  descripcion: string
  razonSocial: string
}

export interface InstructivoEmbalajeDetalleItem {
  id: number
  instructivoId: number
  articuloId: number
  articulo: MantenedorRef & { etiqueta: MantenedorRef | null }
  especieId: number
  especie: MantenedorRef
  variedadId: number
  variedad: MantenedorRef
  variedadRotuladaId: number | null
  variedadRotulada: MantenedorRef | null
  categoriaId: number
  categoria: MantenedorRef
  calibres: { calibre: MantenedorRef }[]
  tipoPalletId: number | null
  tipoPallet: MantenedorRef | null
  alturaId: number
  altura: MantenedorRef
  cantidadPallets: number
  cajasPorPallet: number
  cajas: number
}

export interface InstructivoEmbalajeListItem {
  id: number
  numero: number
  entidadProductorId: number
  entidadProductor: EntidadRef
  creadoEn: string
  estadoInspeccion: EstadoInspeccionProceso
  // Solo viene en el listado (conteo liviano); el detalle trae `folios`
  // completo más abajo en vez de este conteo.
  _count?: { folios: number }
}

export interface InstructivoEmbalajeDetalle extends InstructivoEmbalajeListItem {
  grupoMercadoId: number
  grupoMercado: MantenedorRef
  fechaInicioPrograma: string
  observaciones: string | null
  detalle: InstructivoEmbalajeDetalleItem[]
  creadoPor: string
  comentarioInspeccion: string | null
  inspeccionadoEn: string | null
  inspeccionadoPor: string | null
  notificadaEn: string | null
  folios: InstructivoEmbalajeFolio[]
}

export interface InstructivoEmbalajeListResponse {
  data: InstructivoEmbalajeListItem[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface InstructivoEmbalajeDetalleInput {
  articuloId: number
  especieId: number
  variedadId: number
  variedadRotuladaId: number | null
  categoriaId: number
  calibreIds: number[]
  tipoPalletId: number | null
  alturaId: number
  cantidadPallets: number
  cajasPorPallet: number
  cajas: number
}

export interface InstructivoEmbalajeCreateInput {
  entidadProductorId: number
  grupoMercadoId: number
  fechaInicioPrograma: string
  observaciones?: string | null
  detalle: InstructivoEmbalajeDetalleInput[]
}

export interface InstructivoEmbalajeListFilters {
  page?: number
  limit?: number
  entidadProductorId?: number
  estadoInspeccion?: EstadoInspeccionProceso
  // Instructivos válidos como fuente de folios en Recepción de Proceso
  // (2026-09-01): Aprobada o Cerrada. Ignorado si viene estadoInspeccion.
  seleccionable?: boolean
}

export interface InstructivoEmbalajeUpdateInput {
  entidadProductorId?: number
  grupoMercadoId?: number
  fechaInicioPrograma?: string
  observaciones?: string | null
  detalle?: InstructivoEmbalajeDetalleInput[]
}

export interface FoliosCreateInput {
  folios: string[]
}
