export type NivelAcceso = 'SIN_ACCESO' | 'LECTURA' | 'TOTAL'

export interface PerfilListItem {
  id: number
  codigo: string
  descripcion: string
  creadoEn: Date
  _count?: { usuarios: number }
}

export interface AccesoItem {
  itemMenuId: number
  nivel: NivelAcceso
  itemMenu: {
    id: number
    codigo: string
    nombre: string
    seccion: string
    ruta: string | null
    esAccion: boolean
    orden: number
  }
}

export interface PerfilDetalle {
  id: number
  codigo: string
  descripcion: string
  creadoEn: Date
  accesos: AccesoItem[]
}

export interface AccesoInput {
  itemMenuId: number
  nivel: NivelAcceso
}

export interface PerfilCreateInput {
  codigo: string
  descripcion: string
  accesos?: AccesoInput[]
}

export interface PerfilUpdateInput {
  codigo?: string
  descripcion?: string
  accesos?: AccesoInput[]
}
