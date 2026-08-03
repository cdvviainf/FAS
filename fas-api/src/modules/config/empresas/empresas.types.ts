export interface EmpresaListItem {
  id: number
  codigo: string
  razonSocial: string
  nombreFantasia: string | null
  rut: string | null
  activo: boolean
  creadoEn: Date
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
  creadoEn: Date
  creadoPor: string
  actualizadoEn: Date | null
  actualizadoPor: string | null
  direcciones: DireccionItem[]
  contactos: ContactoItem[]
}

export interface DireccionItem {
  id: number
  codigo: string
  descripcion: string
  direccion: string
  esPorDefecto: boolean
  latitud: string | null
  longitud: string | null
  creadoEn: Date
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
  creadoEn: Date
}
