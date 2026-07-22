import type { TipoEntidad } from '@prisma/client'

export type { TipoEntidad }

export interface EntidadListItem {
  id: number
  codigo: string
  descripcion: string
  razonSocial: string
  tipos: TipoEntidad[]
  activo: boolean
  creadoEn: Date
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
  creadoEn: Date
  creadoPor: string
  actualizadoEn: Date | null
  actualizadoPor: string | null
  pais: { id: number; codigo: string; descripcion: string; esPaisOrigen: boolean }
  direcciones: DireccionItem[]
  contactos: ContactoItem[]
}

export interface DireccionItem {
  id: number
  codigo: string
  direccion: string
  esPorDefecto: boolean
  creadoEn: Date
  pais: { id: number; codigo: string; descripcion: string }
  comuna: { id: number; codigo: string; descripcion: string } | null
}

export interface ContactoItem {
  id: number
  codigo: string
  nombre: string
  email: string | null
  telefono: string | null
  tipo: string | null
  esRepresentanteLegal: boolean
  creadoEn: Date
}
