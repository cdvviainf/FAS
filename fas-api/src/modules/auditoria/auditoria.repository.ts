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
export async function listar(empresaIdActiva: number | null, filters: AuditoriaListFilters) {
  const { page = 1, limit = 20, usuarioId, accion, entidad, desde, hasta, q } = filters

  const where: Prisma.AuditLogWhereInput = {
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
