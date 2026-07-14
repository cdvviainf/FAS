import Fastify from 'fastify'
import { env } from './config/env.js'
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

// Rutas
await app.register(healthRoutes)
await app.register(configRoutes, { prefix: '/api/config' })
// await app.register(import('./modules/auth/auth.routes.js'), { prefix: '/api/v1/auth' })

await app.listen({ port: env.PORT, host: '0.0.0.0' })
