export interface PaisOption {
  id: number
  codigo: string
  descripcion: string
  esPaisNacional: boolean
}

export interface ComunaOption {
  id: number
  codigo: string
  descripcion: string
}

export interface DireccionItem {
  id: number
  codigo: string
  descripcion: string
  paisId: number
  comunaId: number | null
  direccion: string
  esPorDefecto: boolean
  latitud: number | null
  longitud: number | null
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

export interface EmpresaListItem {
  id: number
  codigo: string
  razonSocial: string
  nombreFantasia: string | null
  rut: string | null
  activo: boolean
  creadoEn: string
}

export interface EmpresaDetalle {
  id: number
  codigo: string
  razonSocial: string
  nombreFantasia: string | null
  rut: string | null
  giro: string | null
  email: string | null
  telefono: string | null
  activo: boolean
  direcciones: DireccionItem[]
  contactos: ContactoItem[]
}

export interface EmpresaListResponse {
  data: EmpresaListItem[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface EmpresaCreateInput {
  codigo: string
  razonSocial: string
  nombreFantasia?: string
  rut?: string
  giro?: string
  email?: string
  telefono?: string
  activo: boolean
  // Sub-recursos opcionales: solo usados al crear (POST), para que el backend
  // los persista junto con la empresa en una única transacción atómica.
  direcciones?: DireccionCreateInput[]
  contactos?: ContactoCreateInput[]
}

export interface DireccionCreateInput {
  codigo: string
  descripcion: string
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
