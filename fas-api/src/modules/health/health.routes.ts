import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { redis } from '../../lib/redis.js'

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', { schema: { tags: ['Sistema'] } }, async (_req, reply) => {
    const checks: Record<string, string> = { api: 'ok' }

    try {
      await prisma.$queryRaw`SELECT 1`
      checks.database = 'ok'
    } catch {
      checks.database = 'error'
    }

    try {
      await redis.ping()
      checks.redis = 'ok'
    } catch {
      checks.redis = 'error'
    }

    const allOk = Object.values(checks).every((v) => v === 'ok')
    return reply.status(allOk ? 200 : 503).send({
      status: allOk ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    })
  })
}
