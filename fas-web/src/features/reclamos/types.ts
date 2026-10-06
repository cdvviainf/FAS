export type EstadoReclamo = 'INGRESADO' | 'VALORIZADO' | 'CERRADO'
export type Procedencia = 'PROCEDENTE' | 'IMPROCEDENTE' | 'PARCIAL'
export type TipoCalculoProvision = 'POR_UNIDAD_CAJA' | 'POR_PESO_KILO' | 'MONTO_FIJO'
export type EstadoProvision = 'VIGENTE' | 'REVERSADA'

export const ESTADO_RECLAMO_LABELS: Record<EstadoReclamo, string> = {
  INGRESADO: 'Ingresado',
  VALORIZADO: 'Valorizado',
  CERRADO: 'Cerrado',
}

export const PROCEDENCIA_LABELS: Record<Procedencia, string> = {
  PROCEDENTE: 'Procedente',
  IMPROCEDENTE: 'Improcedente',
  PARCIAL: 'Parcial',
}

export const TIPO_CALCULO_PROVISION_LABELS: Record<TipoCalculoProvision, string> = {
  POR_UNIDAD_CAJA: 'Por caja',
  POR_PESO_KILO: 'Por kilo',
  MONTO_FIJO: 'Monto cerrado',
}

interface MantenedorRef {
  id: number
  codigo: string
  descripcion: string
}

// Tipo de Reclamo (2026-10-01): clasifica el reclamo y decide, vía
// `generaAnalisisCalidad`, si pasa a la pantalla de Calidad.
export interface TipoReclamoRef {
  id: number
  codigo: string
  descripcion: string
  generaAnalisisCalidad: boolean
}

// Línea de pallet candidata para marcar en un Reclamo — trae cuánto ya está
// reclamado (entre TODOS los reclamos, R-NEW1) y cuánto queda disponible.
export interface LineaReclamable {
  id: number
  especie: MantenedorRef
  variedad: MantenedorRef
  categoria: MantenedorRef
  calibre: MantenedorRef
  articulo: MantenedorRef
  cajas: number
  cajasReclamadas: number
  cajasDisponibles: number
}

export interface PalletReclamable {
  id: number
  numeroPallet: string
  lineas: LineaReclamable[]
}

export interface ReclamoLinea {
  id: number
  palletLineaId: number
  cantidadCajas: number
  palletLinea: {
    id: number
    cajas: number
    pallet: { id: number; numeroPallet: string }
    especie: MantenedorRef
    variedad: MantenedorRef
    categoria: MantenedorRef
    calibre: MantenedorRef
    articulo: MantenedorRef
  }
}

// Línea de defecto del análisis de Calidad (2026-10-06): grupo (Calidad/
// Condición) + defecto + porcentaje.
export interface ReclamoDefecto {
  id: number
  porcentaje: string
  grupoDefecto: MantenedorRef
  defecto: MantenedorRef
}

export interface ReclamoDocumento {
  id: number
  nombre: string
  mime: string
  tamano: number
  subidoEn: string
  subidoPor: string
}

export interface Provision {
  id: number
  reclamoId: number
  tipoCalculo: TipoCalculoProvision
  valorUnitario: string | null
  cantidadAfectada: string | null
  montoFijo: string | null
  montoCalculado: string
  estado: EstadoProvision
  fechaCreacion: string
  creadoPorId: string
  fechaReversa: string | null
  reversadoPorId: string | null
  reversadaPorValorizacion: boolean
}

export interface Reclamo {
  id: number
  // Correlativo propio (2026-10-06).
  codigo: string
  embarqueId: number
  // numeroContenedorManual + solicitudReserva.numeroContenedor: el contenedor
  // del Embarque (derivado, solo lectura en el Reclamo).
  embarque: {
    id: number
    numeroInstructivo: string
    numeroContenedorManual: string | null
    solicitudReserva: { numeroContenedor: string | null } | null
  }
  clienteId: number
  cliente: MantenedorRef
  monedaId: number
  moneda: MantenedorRef
  tipoReclamoId: number | null
  tipoReclamo: TipoReclamoRef | null
  fechaReclamo: string
  resumenCliente: string | null
  estado: EstadoReclamo
  procedencia: Procedencia | null
  comentarioCalidad: string | null
  // Clasificación del reclamo (GrupoDefecto, Calidad/Condición) — 2026-10-06.
  grupoDefectoId: number | null
  grupoDefecto: MantenedorRef | null
  defectos: ReclamoDefecto[]
  valorConfirmado: string | null
  valorizadoPor: string | null
  fechaValorizacion: string | null
  temporadaId: number | null
  lineas: ReclamoLinea[]
  documentos: ReclamoDocumento[]
  provisiones: Provision[]
  creadoEn: string
  creadoPor: string
}

// Helper: el contenedor a mostrar en el Reclamo (derivado del Embarque).
export function numeroContenedorDeReclamo(r: Reclamo): string | null {
  return r.embarque.numeroContenedorManual ?? r.embarque.solicitudReserva?.numeroContenedor ?? null
}

// Payload del análisis de Calidad (2026-10-06): comentario + clasificación +
// líneas de defecto.
export interface ReclamoDefectoInput {
  grupoDefectoId: number
  defectoId: number
  porcentaje: number
}

export interface AnalisisCalidadInput {
  comentarioCalidad: string
  grupoDefectoId?: number | null
  defectos?: ReclamoDefectoInput[]
}

export interface ProvisionInput {
  tipoCalculo: TipoCalculoProvision
  valorUnitario?: number | null
  cantidadAfectada?: number | null
  montoFijo?: number | null
}

export interface ReclamoCreateInput {
  fechaReclamo: string
  tipoReclamoId: number
  resumenCliente?: string | null
  temporadaId?: number | null
  lineas: { palletLineaId: number; cantidadCajas: number }[]
  provision?: ProvisionInput | null
}

// IMP-QA-R1-019: edición — sin `provision` (tiene su propio endpoint).
export interface ReclamoUpdateInput {
  fechaReclamo?: string
  tipoReclamoId?: number
  resumenCliente?: string | null
  temporadaId?: number | null
  lineas?: { palletLineaId: number; cantidadCajas: number }[]
}

export interface ReclamosListFilters {
  page?: number
  limit?: number
  estado?: EstadoReclamo
  embarqueId?: number
  clienteId?: number
  // IMP-QA-R1-022: búsqueda por folio del Embarque.
  folio?: string
  // Pantalla de Calidad (2026-10-01): solo reclamos cuyo tipo genera análisis.
  soloConAnalisis?: boolean
}

export interface ReclamosListResponse {
  data: Reclamo[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

// IMP-QA-R1-023: además de los pallets candidatos, trae cliente/moneda
// heredados del Embarque para mostrarlos en el diálogo de creación.
export interface LineasReclamablesResponse {
  cliente: MantenedorRef
  moneda: MantenedorRef
  pallets: PalletReclamable[]
}
