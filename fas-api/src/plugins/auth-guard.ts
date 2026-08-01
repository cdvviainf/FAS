import type { preHandlerHookHandler } from 'fastify'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from '../lib/auth.js'
import { prisma } from '../lib/prisma.js'
import { empresaContext } from '../lib/empresa-context.js'

declare module 'fastify' {
  interface FastifyRequest {
    fasUserId?: string
    fasUserPerfilId?: number
    // accesos del perfil indexados por código de ítem de menú (cargados en requireAuth)
    fasAccesos?: Map<string, 'SIN_ACCESO' | 'LECTURA' | 'TOTAL'>
    // empresa activa resuelta (multi-empresa, Fase 1). Null si el usuario no
    // tiene ninguna empresa asignada todavía (modo soft — no bloquea, ver
    // Docs/empresas.md §4 Fase 1).
    fasEmpresaId?: number | null
  }
}

/**
 * Verifica sesión activa y carga en una sola query:
 *   - fasUserId
 *   - fasUserPerfilId
 *   - fasAccesos (Map<codigoItemMenu, nivel>) — evita consulta adicional en requireLevel
 *   - fasEmpresaId — resuelto desde el header X-Empresa-Id (validado contra las
 *     membresías del usuario) o, en su ausencia, desde empresaPredeterminadaId
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
      empresaPredeterminadaId: true,
      // Solo membresías a empresas activas y no eliminadas — una empresa
      // desactivada/soft-deleted no debe aceptarse en X-Empresa-Id ni como
      // fallback de predeterminada, aunque exista la fila de membresía.
      empresas: { where: { empresa: { activo: true, eliminadoEn: null } }, select: { empresaId: true } },
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

  const headerRaw = request.headers['x-empresa-id']
  let empresaId: number | null = null
  if (headerRaw != null) {
    const parsed = Number(Array.isArray(headerRaw) ? headerRaw[0] : headerRaw)
    if (!Number.isInteger(parsed)) {
      reply.status(400).send({ error: { code: 'EMPRESA_INVALIDA', message: 'X-Empresa-Id inválido.' } })
      return
    }
    const esMiembro = usuario.empresas.some((e) => e.empresaId === parsed)
    if (!esMiembro) {
      reply.status(403).send({ error: { code: 'EMPRESA_NO_AUTORIZADA', message: 'No tiene acceso a esta empresa.' } })
      return
    }
    empresaId = parsed
  } else {
    // La predeterminada solo es válida si sigue siendo una membresía activa
    // (empresas ya viene filtrado por activo/eliminadoEn arriba).
    const predeterminadaId = usuario.empresaPredeterminadaId
    empresaId = predeterminadaId != null && usuario.empresas.some((e) => e.empresaId === predeterminadaId)
      ? predeterminadaId
      : null
  }

  request.fasEmpresaId = empresaId
  const store = empresaContext.getStore()
  if (store) store.empresaId = empresaId
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
