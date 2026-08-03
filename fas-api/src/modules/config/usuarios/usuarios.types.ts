export interface EmpresaAsignada {
  id: number
  codigo: string
  razonSocial: string
  activo: boolean
}

export interface UsuarioListItem {
  id: string
  nombre: string
  email: string
  whatsapp: string | null
  imagenUrl: string | null
  perfilId: number
  perfil: { id: number; codigo: string; descripcion: string }
  esResponsableVenta: boolean
  empresaPredeterminadaId: number | null
  empresas: EmpresaAsignada[]
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
  esResponsableVenta?: boolean
  password: string
  passwordConfirm: string
  empresas: number[]
  empresaPredeterminadaId?: number | null
}

export interface UsuarioUpdateInput {
  nombre?: string
  whatsapp?: string
  imagenUrl?: string
  perfilId?: number
  esResponsableVenta?: boolean
  empresas?: number[]
  empresaPredeterminadaId?: number | null
}

export interface CambiarPasswordInput {
  password: string
  passwordConfirm: string
}
