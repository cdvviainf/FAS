import { PrismaClient } from '@prisma/client'
import { withTenancy } from './prisma-tenancy.js'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  withTenancy(
    new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    }),
  )

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
