export type NivelAcceso = 'SIN_ACCESO' | 'LECTURA' | 'TOTAL'

export interface ItemMenu {
  id: number
  codigo: string
  nombre: string
  seccion: string
  ruta: string | null
  esAccion: boolean
  orden: number
  activo: boolean
}

export interface AccesoItem {
  itemMenuId: number
  nivel: NivelAcceso
  itemMenu: Omit<ItemMenu, 'activo'>
}

export interface Perfil {
  id: number
  codigo: string
  descripcion: string
  creadoEn: string
  _count?: { usuarios: number }
}

export interface PerfilDetalle extends Perfil {
  accesos: AccesoItem[]
}

export interface PerfilListResponse {
  data: Perfil[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface PerfilCreateInput {
  codigo: string
  descripcion: string
  accesos?: { itemMenuId: number; nivel: NivelAcceso }[]
}

export interface PerfilUpdateInput {
  codigo?: string
  descripcion?: string
  accesos?: { itemMenuId: number; nivel: NivelAcceso }[]
}
