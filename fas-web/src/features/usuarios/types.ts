export interface Usuario {
  id: string
  nombre: string
  email: string
  whatsapp: string | null
  imagenUrl: string | null
  perfilId: number
  perfil: { id: number; codigo: string; descripcion: string }
  creadoEn: string
  actualizadoEn: string | null
}

export interface UsuarioListResponse {
  data: Usuario[]
  meta: { total: number; page: number; limit: number; totalPages: number }
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
  whatsapp?: string | null
  imagenUrl?: string | null
  perfilId?: number
}
