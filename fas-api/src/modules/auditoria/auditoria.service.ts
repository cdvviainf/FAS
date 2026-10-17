import type { AccionAuditoria } from '@prisma/client'
import { prismaBase } from '../../lib/prisma.js'
import { getEmpresaIdActual } from '../../lib/empresa-context.js'
import { getAuditoriaContext } from '../../lib/auditoria/auditoria-context.js'
import { encolarAuditoria } from './auditoria.queue.js'
import * as repo from './auditoria.repository.js'
import type { AuditoriaListFilters } from './auditoria.types.js'

// Registra el acceso a una pantalla/menú del frontend (ACCESO_MENU). Toma
// usuario/ip/empresa del contexto del request en curso.
export async function registrarNavegacion(input: { ruta: string; itemMenuCodigo?: string | null }) {
  const ctx = getAuditoriaContext()
  await encolarAuditoria({
    empresaId: getEmpresaIdActual(),
    usuarioId: ctx.usuarioId,
    usuarioEmail: ctx.usuarioEmail,
    accion: 'ACCESO_MENU',
    ruta: input.ruta,
    itemMenuCodigo: input.itemMenuCodigo ?? null,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  })
}

// Registra eventos de acceso al sistema (LOGIN / LOGOUT / LOGIN_FALLIDO). Los
// datos vienen explícitos porque estos eventos ocurren en el flujo de auth,
// donde puede no haber contexto de request resuelto aún.
export async function registrarAcceso(
  accion: Extract<AccionAuditoria, 'LOGIN' | 'LOGOUT' | 'LOGIN_FALLIDO'>,
  datos: {
    usuarioId?: string | null
    usuarioEmail?: string | null
    empresaId?: number | null
    ip?: string | null
    userAgent?: string | null
  },
) {
  let usuarioId = datos.usuarioId ?? null
  let empresaId = datos.empresaId ?? null

  // Resolver la empresa del evento para mantener el aislamiento multiempresa
  // (A-QA-002): un evento de acceso debe quedar en la empresa predeterminada
  // del usuario, no como evento global. Se resuelve por id o por email.
  if (empresaId == null && (usuarioId || datos.usuarioEmail)) {
    try {
      const usuario = await prismaBase.usuario.findFirst({
        where: usuarioId ? { id: usuarioId } : { email: datos.usuarioEmail! },
        select: { id: true, empresaPredeterminadaId: true },
      })
      if (usuario) {
        usuarioId = usuario.id
        empresaId = usuario.empresaPredeterminadaId ?? null
      }
    } catch {
      /* best-effort: si no resuelve, queda como evento global (empresaId null) */
    }
  }

  await encolarAuditoria({
    empresaId,
    usuarioId,
    usuarioEmail: datos.usuarioEmail ?? null,
    accion,
    ip: datos.ip ?? null,
    userAgent: datos.userAgent ?? null,
  })
}

export async function listar(filters: AuditoriaListFilters) {
  const empresaIdActiva = getEmpresaIdActual()
  const { page = 1, limit = 20 } = filters
  // Sin empresa activa no hay vista por-empresa que mostrar: nunca se exponen
  // eventos globales (empresaId null) en esta consulta (A-QA-002).
  if (empresaIdActiva == null) {
    return { data: [], meta: { total: 0, page, limit, totalPages: 0 } }
  }
  const { data, total } = await repo.listar(empresaIdActiva, filters)
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}
