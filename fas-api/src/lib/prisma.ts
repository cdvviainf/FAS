import { PrismaClient } from '@prisma/client'
import { withTenancy } from './prisma-tenancy.js'
import { withAuditoria } from './auditoria/prisma-auditoria.js'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient
  prismaBase: PrismaClient
}

// Cliente base SIN extensiones — uso interno de la auditoría (pre-reads y
// escritura del propio AuditLog), para no re-disparar tenancy ni auditoría.
const base =
  globalForPrisma.prismaBase ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

export const prismaBase = base

// Orden de extensiones: auditoría INNER (ve los args ya scoped por tenancy),
// tenancy OUTER (inyecta/filtra empresaId antes de llegar a auditoría).
export const prisma = globalForPrisma.prisma ?? withTenancy(withAuditoria(base))

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaBase = base
}
