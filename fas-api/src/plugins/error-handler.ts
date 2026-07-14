import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { BusinessError } from '../shared/errors.js'

export async function errorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          details: error.flatten(),
        },
      })
    }

    if (error instanceof BusinessError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      })
    }

    // Errores de Fastify (ej: 404 de ruta no encontrada)
    const fastifyError = error as { statusCode?: number; message: string }
    if (fastifyError.statusCode && fastifyError.statusCode < 500) {
      return reply.status(fastifyError.statusCode).send({
        error: { code: 'REQUEST_ERROR', message: fastifyError.message },
      })
    }

    app.log.error(error as Error)
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
    })
  })
}
