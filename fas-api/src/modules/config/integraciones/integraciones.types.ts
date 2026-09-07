export type TipoParametroIntegracion = 'TEXTO' | 'MAESTRO'
export type MaestroIntegracion = 'ENTIDAD' | 'ESPECIE' | 'TIPO_EMBARQUE' | 'PUERTO'

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
