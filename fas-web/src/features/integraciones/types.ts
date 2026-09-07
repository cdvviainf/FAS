export type TipoParametroIntegracion = 'TEXTO' | 'MAESTRO'
export type MaestroIntegracion = 'ENTIDAD' | 'ESPECIE' | 'TIPO_EMBARQUE' | 'PUERTO'

export const MAESTRO_INTEGRACION_LABELS: Record<MaestroIntegracion, string> = {
  ENTIDAD: 'Entidad',
  ESPECIE: 'Especie',
  TIPO_EMBARQUE: 'Tipo de Embarque',
  PUERTO: 'Puerto',
}

export interface IntegracionParametro {
  id: number
  integracionId: number
  idExterno: string
  tipo: TipoParametroIntegracion
  maestro: MaestroIntegracion | null
  maestroId: number | null
  valorLocal: string
  // Enmascarado ('••••••••') por el backend cuando sensible = true — nunca
  // llega el valor real ni cifrado por API (ver integraciones.repository.ts).
  valorExterno: string
  sensible: boolean
  descripcion: string | null
}

export interface Integracion {
  id: number
  codigo: string
  descripcion: string
  url: string | null
  activo: boolean
  parametros: IntegracionParametro[]
}

export interface IntegracionListItem {
  id: number
  codigo: string
  descripcion: string
  url: string | null
  activo: boolean
}

export interface IntegracionCreateInput {
  codigo: string
  descripcion: string
  url?: string | null
  activo?: boolean
}

export type IntegracionUpdateInput = Partial<Omit<IntegracionCreateInput, 'codigo'>>

export interface IntegracionParametroInput {
  idExterno: string
  tipo: TipoParametroIntegracion
  maestro?: MaestroIntegracion | null
  maestroId?: number | null
  valorLocal?: string
  valorExterno?: string
  sensible?: boolean
  descripcion?: string | null
}

export type IntegracionParametroUpdateInput = Partial<IntegracionParametroInput>

export interface IntegracionListFilters {
  page?: number
  limit?: number
}

export interface IntegracionListResponse {
  data: IntegracionListItem[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface OpcionMaestro {
  id: number
  codigo: string
  descripcion: string
}
