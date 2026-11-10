export interface EmpresaAsignada {
  id: number
  codigo: string
  razonSocial: string
  activo: boolean
}

export interface Usuario {
  id: string
  nombre: string
  email: string
  whatsapp: string | null
  imagenUrl: string | null
  perfilId: number
  perfil: { id: number; codigo: string; descripcion: string }
  esResponsableVenta: boolean
  puedeEditarCierresAjenos: boolean
  esInspectorCalidad: boolean
  // Tiene firma PNG cargada (binario por GET /config/usuarios/:id/firma).
  tieneFirma: boolean
  empresaPredeterminadaId: number | null
  empresas: EmpresaAsignada[]
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
  perfilId: number
  esResponsableVenta?: boolean
  puedeEditarCierresAjenos?: boolean
  esInspectorCalidad?: boolean
  password: string
  passwordConfirm: string
  empresas: number[]
  empresaPredeterminadaId?: number | null
}

export interface UsuarioUpdateInput {
  nombre?: string
  whatsapp?: string | null
  perfilId?: number
  esResponsableVenta?: boolean
  puedeEditarCierresAjenos?: boolean
  esInspectorCalidad?: boolean
  empresas?: number[]
  empresaPredeterminadaId?: number | null
}
