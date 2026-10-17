import type { AccionAuditoria } from '@prisma/client'

// Evento de auditoría tal como se encola y persiste. Todos los snapshots ya
// vienen enmascarados (sin datos sensibles) desde quien lo genera.
export interface EventoAuditoria {
  empresaId: number | null
  usuarioId: string | null
  usuarioEmail: string | null
  accion: AccionAuditoria
  entidad?: string | null
  entidadId?: string | null
  ruta?: string | null
  itemMenuCodigo?: string | null
  datosAntes?: unknown
  datosDespues?: unknown
  resumen?: unknown
  ip?: string | null
  userAgent?: string | null
}

export interface AuditoriaListFilters {
  page?: number
  limit?: number
  usuarioId?: string
  accion?: AccionAuditoria
  entidad?: string
  desde?: string // ISO date
  hasta?: string // ISO date
  q?: string
}
