import Fastify from 'fastify'
import { env } from './config/env.js'
import { auth } from './lib/auth.js'
import { toNodeHandler } from 'better-auth/node'
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
  methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
})
await app.register(import('@fastify/helmet'))
await errorHandler(app)
await swaggerPlugin(app)

// Better Auth — maneja todas las rutas de autenticación bajo /api/auth/*
// toNodeHandler convierte el handler de Better Auth (Web API Request) al formato Node.js http
const betterAuthHandler = toNodeHandler(auth)
app.all('/api/auth/*', (req, reply) => {
  // Better Auth escribe directamente en reply.raw (Node.js ServerResponse).
  // Usamos hijackResponse para que Fastify no interfiera con la respuesta.
  reply.hijack()
  return betterAuthHandler(req.raw, reply.raw)
})

// Rutas de aplicación
await app.register(healthRoutes)
await app.register(configRoutes, { prefix: '/api/config' })

await app.listen({ port: env.PORT, host: '0.0.0.0' })
