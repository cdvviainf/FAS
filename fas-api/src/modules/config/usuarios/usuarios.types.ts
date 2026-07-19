export interface UsuarioListItem {
  id: string
  nombre: string
  email: string
  whatsapp: string | null
  imagenUrl: string | null
  perfilId: number
  perfil: { id: number; codigo: string; descripcion: string }
  creadoEn: Date
}

export interface UsuarioDetalle extends UsuarioListItem {
  actualizadoEn: Date | null
}

export interface UsuarioCreateInput {
  nombre: string
  email: string
  whatsapp?: string
  imagenUrl?: string
  perfilId: number
  password: string
  passwordConfirm: string
}

export interface UsuarioUpdateInput {
  nombre?: string
  whatsapp?: string
  imagenUrl?: string
  perfilId?: number
}

export interface CambiarPasswordInput {
  password: string
  passwordConfirm: string
}
