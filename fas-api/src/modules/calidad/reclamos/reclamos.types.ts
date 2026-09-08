export type TipoCalculoProvision = 'POR_UNIDAD_CAJA' | 'POR_PESO_KILO' | 'MONTO_FIJO'
export type EstadoProvision = 'VIGENTE' | 'REVERSADA'
export type EstadoReclamo = 'INGRESADO' | 'VALORIZADO' | 'CERRADO'
export type Procedencia = 'PROCEDENTE' | 'IMPROCEDENTE' | 'PARCIAL'

export interface ReclamoLineaInput {
  palletLineaId: number
  cantidadCajas: number
}

export interface ProvisionInput {
  tipoCalculo: TipoCalculoProvision
  valorUnitario?: number | null
  cantidadAfectada?: number | null
  montoFijo?: number | null
}

export interface ReclamoCreateInput {
  fechaReclamo?: string | null
  resumenCliente?: string | null
  temporadaId?: number | null
  lineas: ReclamoLineaInput[]
  provision?: ProvisionInput | null
}

// IMP-QA-R1-019: edición de cabecera/líneas — sin `provision` (esa tiene su
// propio endpoint crear/reversar, no se edita acá).
export interface ReclamoUpdateInput {
  fechaReclamo?: string | null
  resumenCliente?: string | null
  temporadaId?: number | null
  lineas?: ReclamoLineaInput[]
}

export interface ReclamoListFilters {
  page?: number
  limit?: number
  estado?: EstadoReclamo
  embarqueId?: number
  clienteId?: number
  // IMP-QA-R1-022: búsqueda por folio (numeroInstructivo) del Embarque.
  folio?: string
}

export interface AnalisisCalidadInput {
  comentarioCalidad: string
}

export interface ValorizarInput {
  valorConfirmado: number
}

export interface CerrarInput {
  procedencia: Procedencia
}

export interface DocumentoArchivo {
  nombre: string
  mime: string
  datos: Buffer
}
