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

// Facetas (usuarios/entidades presentes en la bitácora de la empresa activa)
// para alimentar los selectores del frontend sin requerir CONFIG_USUARIOS.
export async function facetas() {
  const empresaIdActiva = getEmpresaIdActual()
  if (empresaIdActiva == null) return { usuarios: [], entidades: [] }
  return repo.facetas(empresaIdActiva)
}

// Tope de filas por export para no agotar memoria; si se supera, el CSV incluye
// las más recientes y el controller avisa por cabecera (sin truncado silencioso).
const MAX_EXPORT = 10_000

function campoCsv(valor: unknown): string {
  if (valor == null) return ''
  const s = typeof valor === 'string' ? valor : JSON.stringify(valor)
  // Escape RFC 4180: comillas dobles y envoltura si hay coma/comilla/salto.
  const escapado = s.replace(/"/g, '""')
  return /[",\n\r]/.test(s) ? `"${escapado}"` : escapado
}

export async function exportarCsv(filters: AuditoriaListFilters): Promise<{ csv: string; total: number; truncado: boolean }> {
  const empresaIdActiva = getEmpresaIdActual()
  if (empresaIdActiva == null) return { csv: '', total: 0, truncado: false }
  const { rows, total, truncado } = await repo.listarParaExport(empresaIdActiva, filters, MAX_EXPORT)

  const encabezado = ['Fecha', 'Usuario', 'Accion', 'Entidad', 'EntidadId', 'Ruta', 'ItemMenu', 'IP']
  const lineas = rows.map((r) =>
    [
      r.creadoEn.toISOString(),
      r.usuarioEmail,
      r.accion,
      r.entidad,
      r.entidadId,
      r.ruta,
      r.itemMenuCodigo,
      r.ip,
    ]
      .map(campoCsv)
      .join(','),
  )
  // BOM para que Excel reconozca UTF-8.
  const csv = '﻿' + [encabezado.join(','), ...lineas].join('\r\n')
  return { csv, total, truncado }
}
