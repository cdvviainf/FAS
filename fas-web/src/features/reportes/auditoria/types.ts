export type AccionAuditoria =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FALLIDO'
  | 'ACCESO_MENU'
  | 'CREAR'
  | 'EDITAR'
  | 'ELIMINAR'

export const ACCION_LABELS: Record<AccionAuditoria, string> = {
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  LOGIN_FALLIDO: 'Login fallido',
  ACCESO_MENU: 'Acceso a menú',
  CREAR: 'Creación',
  EDITAR: 'Edición',
  ELIMINAR: 'Eliminación',
}

// Fila de la bitácora tal como la devuelve GET /api/auditoria.
export interface AuditLogRow {
  id: number
  empresaId: number | null
  usuarioId: string | null
  usuarioEmail: string | null
  accion: AccionAuditoria
  entidad: string | null
  entidadId: string | null
  ruta: string | null
  itemMenuCodigo: string | null
  datosAntes: unknown | null
  datosDespues: unknown | null
  resumen: unknown | null
  ip: string | null
  userAgent: string | null
  creadoEn: string
}

export interface AuditoriaListResponse {
  data: AuditLogRow[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

// Facetas para los filtros (GET /api/auditoria/facetas): solo los usuarios y
// entidades que aparecen en la bitácora de la empresa activa.
export interface AuditoriaFacetas {
  usuarios: { usuarioId: string; usuarioEmail: string | null }[]
  entidades: string[]
}

export interface AuditoriaListParams {
  page?: number
  limit?: number
  usuarioId?: string
  accion?: AccionAuditoria
  entidad?: string
  // Fechas en formato ISO date (YYYY-MM-DD) o datetime.
  desde?: string
  hasta?: string
  q?: string
}
