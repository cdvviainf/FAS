import type { preHandlerHookHandler } from 'fastify'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from '../lib/auth.js'
import { prisma } from '../lib/prisma.js'

declare module 'fastify' {
  interface FastifyRequest {
    fasUserId?: string
    fasUserPerfilId?: number
  }
}

// Verifica sesión activa y adjunta fasUserId + fasUserPerfilId al request
export const requireAuth: preHandlerHookHandler = async (request, reply) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  })
  if (!session?.user) {
    reply
      .status(401)
      .send({ error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida.' } })
    return
  }
  const usuario = await prisma.usuario.findFirst({
    where: { id: session.user.id, eliminadoEn: null },
    select: { id: true, perfilId: true },
  })
  if (!usuario) {
    reply
      .status(401)
      .send({ error: { code: 'UNAUTHORIZED', message: 'Sesión inválida o usuario inactivo.' } })
    return
  }
  request.fasUserId = usuario.id
  request.fasUserPerfilId = usuario.perfilId
}

// Verifica que el usuario tenga al menos el nivel indicado en el ítem de menú
export function requireLevel(
  itemMenuCodigo: string,
  minLevel: 'LECTURA' | 'TOTAL',
): preHandlerHookHandler {
  return async (request, reply) => {
    const perfilId = request.fasUserPerfilId
    if (!perfilId) {
      reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Acceso denegado.' } })
      return
    }
    const acceso = await prisma.perfilAcceso.findFirst({
      where: { perfilId, itemMenu: { codigo: itemMenuCodigo } },
      select: { nivel: true },
    })
    const nivel = acceso?.nivel ?? 'SIN_ACCESO'
    if (minLevel === 'LECTURA' && nivel === 'SIN_ACCESO') {
      reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'No tiene acceso a esta función.' } })
      return
    }
    if (minLevel === 'TOTAL' && nivel !== 'TOTAL') {
      reply
        .status(403)
        .send({ error: { code: 'FORBIDDEN', message: 'Se requiere acceso total para esta operación.' } })
      return
    }
  }
}
