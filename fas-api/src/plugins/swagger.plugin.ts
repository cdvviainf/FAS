import type { FastifyInstance } from 'fastify'

export async function swaggerPlugin(app: FastifyInstance) {
  await app.register(import('@fastify/swagger'), {
    openapi: {
      info: {
        title: 'FAS API',
        description: 'Sistema de Gestión Integral Frutera Agrosan',
        version: '1.0.0',
      },
      servers: [{ url: 'http://localhost:3001' }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  })

  await app.register(import('@fastify/swagger-ui'), {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  })
}
