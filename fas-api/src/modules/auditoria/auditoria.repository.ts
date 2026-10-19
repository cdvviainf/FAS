import { Prisma } from '@prisma/client'
import { prismaBase } from '../../lib/prisma.js'
import type { EventoAuditoria, AuditoriaListFilters } from './auditoria.types.js'

// Persiste un evento. Usa el cliente base (el worker corre fuera de request y
// AuditLog no es tenant): el empresaId viene explícito en el evento.
export async function crear(evento: EventoAuditoria) {
  return prismaBase.auditLog.create({
    data: {
      empresaId: evento.empresaId,
      usuarioId: evento.usuarioId,
      usuarioEmail: evento.usuarioEmail,
      accion: evento.accion,
      entidad: evento.entidad ?? null,
      entidadId: evento.entidadId ?? null,
      ruta: evento.ruta ?? null,
      itemMenuCodigo: evento.itemMenuCodigo ?? null,
      datosAntes: (evento.datosAntes ?? null) as Prisma.InputJsonValue,
      datosDespues: (evento.datosDespues ?? null) as Prisma.InputJsonValue,
      resumen: (evento.resumen ?? null) as Prisma.InputJsonValue,
      ip: evento.ip ?? null,
      userAgent: evento.userAgent ?? null,
    },
  })
}

// Lista ESTRICTAMENTE acotada a la empresa activa (aislamiento multiempresa,
// A-QA-002): nunca mezcla eventos de otras empresas ni eventos globales
// (empresaId null) en la vista por-empresa. Los eventos globales (ej. login
// fallido de email desconocido) quedan para una vista global futura.
// Filtro común de la vista por-empresa, reutilizado por listar y exportar.
function construirWhere(empresaIdActiva: number | null, filters: AuditoriaListFilters): Prisma.AuditLogWhereInput {
  const { usuarioId, accion, entidad, desde, hasta, q } = filters
  return {
    AND: [
      { empresaId: empresaIdActiva },
      usuarioId ? { usuarioId } : {},
      accion ? { accion } : {},
      entidad ? { entidad } : {},
      desde || hasta
        ? {
            creadoEn: {
              ...(desde ? { gte: new Date(desde) } : {}),
              ...(hasta ? { lte: new Date(hasta) } : {}),
            },
          }
        : {},
      q
        ? {
            OR: [
              { usuarioEmail: { contains: q, mode: 'insensitive' } },
              { entidad: { contains: q, mode: 'insensitive' } },
              { entidadId: { contains: q, mode: 'insensitive' } },
              { ruta: { contains: q, mode: 'insensitive' } },
              { itemMenuCodigo: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {},
    ],
  }
}

export async function listar(empresaIdActiva: number | null, filters: AuditoriaListFilters) {
  const { page = 1, limit = 20 } = filters
  const where = construirWhere(empresaIdActiva, filters)

  const [data, total] = await Promise.all([
    prismaBase.auditLog.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prismaBase.auditLog.count({ where }),
  ])
  return { data, total }
}

// Export: mismas condiciones de filtro, sin paginación, acotado a `max` filas
// para no agotar memoria. Retorna también si hubo truncado (para avisar).
export async function listarParaExport(empresaIdActiva: number | null, filters: AuditoriaListFilters, max: number) {
  const where = construirWhere(empresaIdActiva, filters)
  const [rows, total] = await Promise.all([
    prismaBase.auditLog.findMany({ where, orderBy: { creadoEn: 'desc' }, take: max }),
    prismaBase.auditLog.count({ where }),
  ])
  return { rows, total, truncado: total > rows.length }
}

// Facetas para los selectores del frontend, acotadas a la empresa activa: los
// usuarios y las entidades que REALMENTE aparecen en la bitácora. Así el filtro
// no depende del mantenedor de Usuarios (permiso ajeno — solo CONFIG_AUDITORIA).
export async function facetas(empresaIdActiva: number | null) {
  const [usuarios, entidades] = await Promise.all([
    prismaBase.auditLog.findMany({
      where: { empresaId: empresaIdActiva, usuarioId: { not: null } },
      select: { usuarioId: true, usuarioEmail: true },
      distinct: ['usuarioId'],
      orderBy: { usuarioEmail: 'asc' },
    }),
    prismaBase.auditLog.findMany({
      where: { empresaId: empresaIdActiva, entidad: { not: null } },
      select: { entidad: true },
      distinct: ['entidad'],
      orderBy: { entidad: 'asc' },
    }),
  ])
  return {
    usuarios: usuarios
      .filter((u) => u.usuarioId != null)
      .map((u) => ({ usuarioId: u.usuarioId as string, usuarioEmail: u.usuarioEmail })),
    entidades: entidades.map((e) => e.entidad as string),
  }
}
