import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import { fromNodeHeaders } from 'better-auth/node'
import { env } from './config/env.js'
import { auth } from './lib/auth.js'
import { empresaContext } from './lib/empresa-context.js'
import { auditoriaContext, storeAuditoriaVacio, getAuditoriaContext } from './lib/auditoria/auditoria-context.js'
import { errorHandler } from './plugins/error-handler.js'
import { swaggerPlugin } from './plugins/swagger.plugin.js'
import { validatePasswordComplexity } from './shared/password-validator.js'
import { healthRoutes } from './modules/health/health.routes.js'
import { configRoutes } from './modules/config/config.routes.js'
import { solicitudesRoutes } from './modules/calidad/solicitudes/solicitudes.routes.js'
import { reclamosRoutes, reclamosExternoRoutes } from './modules/calidad/reclamos/reclamos.routes.js'
import { materialesRoutes } from './modules/materiales/materiales.routes.js'
import { productoresRoutes } from './modules/productores/productores.routes.js'
import { ventasRoutes } from './modules/ventas/ventas.routes.js'
import { comprasRoutes } from './modules/compras/compras.routes.js'
import { operacionesRoutes } from './modules/operaciones/operaciones.routes.js'
import { documentosRoutes } from './modules/documentos/documentos.routes.js'
import { auditoriaRoutes } from './modules/auditoria/auditoria.routes.js'
import { registrarAcceso } from './modules/auditoria/auditoria.service.js'
import { encolarAuditoria } from './modules/auditoria/auditoria.queue.js'
import { closeBrowser } from './shared/pdf/browser.js'

export async function buildApp(options: { logger?: boolean } = {}) {
  const app = Fastify({
    logger: options.logger ?? env.NODE_ENV !== 'test'
      ? {
          level: env.NODE_ENV === 'production' ? 'info' : 'debug',
          transport:
            env.NODE_ENV !== 'production'
              ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
              : undefined,
        }
      : false,
  })

  await app.register(import('@fastify/cors'), {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  })
  await app.register(import('@fastify/helmet'))
  await app.register(import('@fastify/multipart'), {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  })
  await errorHandler(app)
  await swaggerPlugin(app)

  // Contexto de empresa activa (multi-empresa, Fase 1). Se inicializa vacío
  // acá para todo request; `requireAuth` lo completa una vez resuelto el
  // usuario y el header X-Empresa-Id.
  app.addHook('onRequest', (_req, _reply, done) => {
    // Ambos contextos ALS activos para todo el request; `requireAuth` los
    // completa. El de auditoría va anidado dentro del de empresa.
    empresaContext.run({ empresaId: null }, () => {
      auditoriaContext.run(storeAuditoriaVacio(), done)
    })
  })

  // Publica los eventos de mutación acumulados durante el request SOLO si la
  // respuesta fue exitosa (A-QA-004): si la operación/transacción falló, la
  // respuesta es de error y los eventos se descartan (no quedan fantasmas).
  app.addHook('onResponse', async (_req, reply) => {
    const store = getAuditoriaContext()
    if (store.pendientes.length === 0) return
    const eventos = store.pendientes.splice(0)
    if (reply.statusCode >= 400) return // operación fallida → se descartan
    for (const evento of eventos) await encolarAuditoria(evento)
  })

  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    // Body crudo preservado para el webhook AGL360 (verificación HMAC contra
    // bytes exactos, ver requireAglWebhookSignature en auth-guard.ts) — barato
    // de guardar para todo request, solo lo lee ese único preHandler.
    // `parseAs: 'buffer'` garantiza Buffer en runtime; el tipo del callback
    // solo es más ancho (string | Buffer) porque el parser también acepta
    // contenido ya-string en otros usos de Fastify.
    req.rawBody = body as Buffer
    if (req.url?.startsWith('/api/auth')) {
      done(null, body)
      return
    }
    try {
      done(null, body.length ? JSON.parse(body.toString('utf8')) : undefined)
    } catch (err) {
      done(err as Error, undefined)
    }
  })

  async function forwardToBetterAuth(req: FastifyRequest, reply: FastifyReply) {
    const protocol = req.protocol ?? 'http'
    const host = req.headers.host ?? 'localhost'
    const url = new URL(req.url, `${protocol}://${host}`)

    const headers = new Headers()
    for (const [key, val] of Object.entries(req.headers)) {
      if (val == null) continue
      if (Array.isArray(val)) {
        for (const v of val) headers.append(key, v)
      } else {
        headers.set(key, val)
      }
    }

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
    const body = hasBody && req.body instanceof Buffer ? req.body : undefined
    const webReq = new Request(url, { method: req.method, headers, body })
    const webRes = await auth.handler(webReq)

    reply.status(webRes.status)
    webRes.headers.forEach((value, key) => reply.header(key, value))
    return reply.send(await webRes.text())
  }

  app.post('/api/auth/sign-up/email', async (_req, reply) => {
    reply.status(403).send({
      error: {
        code: 'REGISTRATION_DISABLED',
        message: 'El registro público está deshabilitado. El alta de usuarios la realiza el administrador del sistema.',
      },
    })
  })

  // UP6: aplicar la misma política de complejidad que usuarios.service.ts antes
  // de delegar a Better Auth, que solo valida el largo mínimo (minPasswordLength).
  app.post('/api/auth/change-password', async (req, reply) => {
    const raw = req.body instanceof Buffer ? req.body.toString('utf8') : ''
    let newPassword = ''
    try {
      newPassword = raw ? (JSON.parse(raw)?.newPassword ?? '') : ''
    } catch {
      // body inválido, se delega a Better Auth para que responda el error de parseo
    }
    if (newPassword) {
      const passwordError = validatePasswordComplexity(newPassword)
      if (passwordError) {
        // Formato plano ({ code, message }) para calzar con los errores nativos
        // de Better Auth (p. ej. INVALID_PASSWORD), que el cliente espera así.
        return reply.status(422).send({ code: 'VALIDATION_ERROR', message: passwordError })
      }
    }
    return forwardToBetterAuth(req, reply)
  })

  app.all('/api/auth/*', forwardToBetterAuth)

  // Auditoría de acceso al sistema. LOGIN se registra en el hook
  // session.create.after de Better Auth (ver lib/auth.ts); acá se capturan
  // LOGOUT y LOGIN_FALLIDO sobre las rutas de auth.
  // En sign-out la sesión aún es válida al llegar el request: se resuelve el
  // usuario antes de que Better Auth la invalide, para registrar quién salió.
  app.addHook('onRequest', async (req) => {
    if (req.url?.startsWith('/api/auth/sign-out')) {
      try {
        const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
        ;(req as FastifyRequest & { logoutUser?: { id: string; email: string } | null }).logoutUser = session?.user
          ? { id: session.user.id, email: session.user.email }
          : null
      } catch {
        /* best-effort: si no se resuelve, se registra sin usuario */
      }
    }
  })

  app.addHook('onResponse', async (req, reply) => {
    const url = req.url ?? ''
    if (!url.startsWith('/api/auth/')) return
    const ip = req.ip
    const userAgent = (req.headers['user-agent'] as string | undefined) ?? null
    try {
      if (url.includes('/sign-out') && reply.statusCode < 400) {
        const u = (req as FastifyRequest & { logoutUser?: { id: string; email: string } | null }).logoutUser ?? null
        await registrarAcceso('LOGOUT', { usuarioId: u?.id ?? null, usuarioEmail: u?.email ?? null, ip, userAgent })
      } else if (url.includes('/sign-in') && reply.statusCode >= 400) {
        let email: string | null = null
        try {
          const raw = req.body instanceof Buffer ? req.body.toString('utf8') : ''
          email = raw ? (JSON.parse(raw)?.email ?? null) : null
        } catch {
          /* body ilegible: se registra sin email */
        }
        await registrarAcceso('LOGIN_FALLIDO', { usuarioEmail: email, ip, userAgent })
      }
    } catch {
      /* la auditoría nunca interfiere con la respuesta de auth */
    }
  })

  await app.register(healthRoutes)
  await app.register(configRoutes, { prefix: '/api/config' })
  await app.register(solicitudesRoutes, { prefix: '/api/calidad' })
  await app.register(reclamosRoutes, { prefix: '/api/calidad' })
  // API externa de solo lectura (reclamos.md, 2026-09-08) — sin sesión FAS,
  // autenticada por RECLAMOS_API_KEY (ver auth-guard.ts).
  await app.register(reclamosExternoRoutes, { prefix: '/api/externo' })
  await app.register(materialesRoutes, { prefix: '/api/materiales' })
  await app.register(productoresRoutes, { prefix: '/api/productores' })
  await app.register(ventasRoutes, { prefix: '/api/ventas' })
  await app.register(comprasRoutes, { prefix: '/api/compras' })
  await app.register(operacionesRoutes, { prefix: '/api/operaciones' })
  await app.register(documentosRoutes, { prefix: '/api/documentos' })
  await app.register(auditoriaRoutes, { prefix: '/api/auditoria' })

  // Motor de Documentos (Etapa 4): cierre ordenado del Chromium compartido
  // (shared/pdf/browser.ts) al apagar el server — evita dejar el proceso
  // colgando de un browser huérfano.
  app.addHook('onClose', closeBrowser)

  return app
}
