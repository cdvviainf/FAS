import type { TipoEntidad, DireccionItem, ContactoItem } from '@/features/entidades/types'
import type { Predio } from './predios/types'
import type { Contrato } from './contratos/types'

export interface ProductorListItem {
  id: number
  codigo: string
  descripcion: string
  razonSocial: string
  activo: boolean
}

export interface ProductorListResponse {
  data: ProductorListItem[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface ProductorFicha {
  id: number
  codigo: string
  descripcion: string
  razonSocial: string
  giro: string | null
  identificador: string | null
  email: string | null
  telefono: string | null
  activo: boolean
  tipos: TipoEntidad[]
  pais: { id: number; descripcion: string }
  contactos: ContactoItem[]
  direcciones: DireccionItem[]
  predios: Predio[]
  contratos: Contrato[]
  tieneRepresentanteLegal: boolean
}
