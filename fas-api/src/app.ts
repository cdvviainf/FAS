import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import { env } from './config/env.js'
import { auth } from './lib/auth.js'
import { errorHandler } from './plugins/error-handler.js'
import { swaggerPlugin } from './plugins/swagger.plugin.js'
import { validatePasswordComplexity } from './shared/password-validator.js'
import { healthRoutes } from './modules/health/health.routes.js'
import { configRoutes } from './modules/config/config.routes.js'
import { solicitudesRoutes } from './modules/calidad/solicitudes/solicitudes.routes.js'
import { materialesRoutes } from './modules/materiales/materiales.routes.js'
import { productoresRoutes } from './modules/productores/productores.routes.js'

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

  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
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

  await app.register(healthRoutes)
  await app.register(configRoutes, { prefix: '/api/config' })
  await app.register(solicitudesRoutes, { prefix: '/api/calidad' })
  await app.register(materialesRoutes, { prefix: '/api/materiales' })
  await app.register(productoresRoutes, { prefix: '/api/productores' })

  return app
}
