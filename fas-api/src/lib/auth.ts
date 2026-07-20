import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin } from 'better-auth/plugins'
import { env } from '../config/env.js'
import { prisma } from './prisma.js'

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  trustedOrigins: [env.CORS_ORIGIN],
  plugins: [admin()],
  databaseHooks: {
    session: {
      create: {
        // RU4: bloquear sesión si el usuario no tiene fila en Usuario o fue soft-deleted
        before: async (session) => {
          const usuario = await prisma.usuario.findFirst({
            where: { id: session.userId, eliminadoEn: null },
            select: { id: true },
          })
          if (!usuario) return false
        },
      },
    },
  },
})

export type Auth = typeof auth
