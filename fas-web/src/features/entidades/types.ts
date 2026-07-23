export type TipoEntidad =
  | 'CLIENTE_NACIONAL'
  | 'CLIENTE_EXTRANJERO'
  | 'NOTIFY'
  | 'CONSIGNATARIO'
  | 'NAVIERA'
  | 'AGENTE_ADUANA'
  | 'COMPANIA_EMBARQUE'
  | 'PROVEEDOR'
  | 'EMPRESA_TRANSPORTE'
  | 'PRODUCTOR'
  | 'EXPORTADORA'
  | 'PLANTA'

export const TIPO_ENTIDAD_LABELS: Record<TipoEntidad, string> = {
  CLIENTE_NACIONAL: 'Cliente',
  CLIENTE_EXTRANJERO: 'Cliente Extranjero',
  NOTIFY: 'Notify',
  CONSIGNATARIO: 'Consignatario',
  NAVIERA: 'Naviera',
  AGENTE_ADUANA: 'Agente Aduana',
  COMPANIA_EMBARQUE: 'Compañía Embarque',
  PROVEEDOR: 'Proveedor',
  EMPRESA_TRANSPORTE: 'Empresa Transporte',
  PRODUCTOR: 'Productor',
  EXPORTADORA: 'Exportadora',
  PLANTA: 'Planta',
}

export const TIPOS_ENTIDAD_ORDEN: TipoEntidad[] = [
  'CLIENTE_NACIONAL',
  'PRODUCTOR',
  'PLANTA',
  'EMPRESA_TRANSPORTE',
  'COMPANIA_EMBARQUE',
  'PROVEEDOR',
  'CLIENTE_EXTRANJERO',
  'AGENTE_ADUANA',
  'CONSIGNATARIO',
  'NOTIFY',
  'NAVIERA',
  'EXPORTADORA',
]

export interface PaisOption {
  id: number
  codigo: string
  descripcion: string
  esPaisOrigen: boolean
}

export interface ComunaOption {
  id: number
  codigo: string
  descripcion: string
}

export interface DireccionItem {
  id: number
  codigo: string
  paisId: number
  comunaId: number | null
  direccion: string
  esPorDefecto: boolean
  latitud: string | number | null
  longitud: string | number | null
  pais: { id: number; codigo: string; descripcion: string }
  comuna: { id: number; codigo: string; descripcion: string } | null
}

export interface ContactoItem {
  id: number
  codigo: string
  nombre: string
  rut: string | null
  whatsapp: string | null
  email: string | null
  telefono: string | null
  tipo: string | null
  esRepresentanteLegal: boolean
}

export interface EntidadListItem {
  id: number
  codigo: string
  descripcion: string
  razonSocial: string
  tipos: TipoEntidad[]
  activo: boolean
  creadoEn: string
  pais: { id: number; codigo: string; descripcion: string }
}

export interface EntidadDetalle {
  id: number
  codigo: string
  descripcion: string
  descripcionExtranjera: string | null
  razonSocial: string
  giro: string | null
  identificador: string | null
  email: string | null
  telefono: string | null
  codigoExterno: string | null
  activo: boolean
  tipos: TipoEntidad[]
  paisId: number
  pais: { id: number; codigo: string; descripcion: string; esPaisOrigen: boolean }
  direcciones: DireccionItem[]
  contactos: ContactoItem[]
}

export interface EntidadListResponse {
  data: EntidadListItem[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface EntidadCreateInput {
  codigo: string
  descripcion: string
  descripcionExtranjera?: string
  razonSocial: string
  giro?: string
  identificador?: string
  paisId: number
  email?: string
  telefono?: string
  codigoExterno?: string
  activo: boolean
  tipos: TipoEntidad[]
}

export interface DireccionCreateInput {
  codigo: string
  paisId: number
  comunaId?: number | null
  direccion: string
  esPorDefecto: boolean
  latitud?: number | null
  longitud?: number | null
}

export interface ContactoCreateInput {
  codigo: string
  nombre: string
  rut?: string
  whatsapp?: string
  email?: string
  telefono?: string
  tipo?: string
  esRepresentanteLegal: boolean
}
