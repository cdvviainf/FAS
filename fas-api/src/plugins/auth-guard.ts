import type { preHandlerHookHandler } from 'fastify'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from '../lib/auth.js'
import { prisma } from '../lib/prisma.js'

declare module 'fastify' {
  interface FastifyRequest {
    fasUserId?: string
    fasUserPerfilId?: number
    // accesos del perfil indexados por código de ítem de menú (cargados en requireAuth)
    fasAccesos?: Map<string, 'SIN_ACCESO' | 'LECTURA' | 'TOTAL'>
  }
}

/**
 * Verifica sesión activa y carga en una sola query:
 *   - fasUserId
 *   - fasUserPerfilId
 *   - fasAccesos (Map<codigoItemMenu, nivel>) — evita consulta adicional en requireLevel
 */
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
    select: {
      id: true,
      perfilId: true,
      perfil: {
        select: {
          accesos: {
            select: {
              nivel: true,
              itemMenu: { select: { codigo: true } },
            },
          },
        },
      },
    },
  })

  if (!usuario) {
    reply
      .status(401)
      .send({ error: { code: 'UNAUTHORIZED', message: 'Sesión inválida o usuario inactivo.' } })
    return
  }

  request.fasUserId = usuario.id
  request.fasUserPerfilId = usuario.perfilId
  request.fasAccesos = new Map(
    usuario.perfil.accesos.map((a) => [a.itemMenu.codigo, a.nivel]),
  )
}

/**
 * Verifica nivel mínimo para un ítem de menú.
 * Debe usarse después de requireAuth — lee fasAccesos sin ir a la BD.
 */
export function requireLevel(
  itemMenuCodigo: string,
  minLevel: 'LECTURA' | 'TOTAL',
): preHandlerHookHandler {
  return async (request, reply) => {
    const nivel = request.fasAccesos?.get(itemMenuCodigo) ?? 'SIN_ACCESO'
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
