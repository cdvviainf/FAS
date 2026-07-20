import Fastify from 'fastify'
import { env } from './config/env.js'
import { auth } from './lib/auth.js'
import { errorHandler } from './plugins/error-handler.js'
import { swaggerPlugin } from './plugins/swagger.plugin.js'
import { healthRoutes } from './modules/health/health.routes.js'
import { configRoutes } from './modules/config/config.routes.js'

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
      env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
        : undefined,
  },
})

// Plugins
await app.register(import('@fastify/cors'), {
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
})
await app.register(import('@fastify/helmet'))
await errorHandler(app)
await swaggerPlugin(app)

// Better Auth — construimos un Web API Request manualmente porque Fastify
// consume el stream del IncomingMessage antes de que toNodeHandler pueda leerlo.
// Necesitamos el body como Buffer para las rutas de auth; para las demás lo
// parseamos a JSON aquí mismo (mismo comportamiento que el parser por defecto).
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

// QA-AUTH-001: Deshabilitar el registro público. El alta de usuarios va por /api/config/usuarios.
app.post('/api/auth/sign-up/email', async (_req, reply) => {
  reply.status(403).send({
    error: {
      code: 'REGISTRATION_DISABLED',
      message: 'El registro público está deshabilitado. El alta de usuarios la realiza el administrador del sistema.',
    },
  })
})

app.all('/api/auth/*', async (req, reply) => {
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
  webRes.headers.forEach((value, key) => {
    reply.header(key, value)
  })
  // Enviar el body de la respuesta
  const text = await webRes.text()
  return reply.send(text)
})

// Rutas de aplicación
await app.register(healthRoutes)
await app.register(configRoutes, { prefix: '/api/config' })

await app.listen({ port: env.PORT, host: '0.0.0.0' })
