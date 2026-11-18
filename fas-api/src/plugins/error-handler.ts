import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { BusinessError } from '../shared/errors.js'

export async function errorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
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

    request.log.error(error as Error)
    // `debug` (2026-11-18): detalle técnico para diagnosticar desde la pestaña
    // Network del navegador sin entrar al log del servidor. La UI sigue
    // mostrando solo `message`. Sin stack trace; el mensaje se recorta.
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor',
        debug: debugError(error, request),
      },
    })
  })
}

// Resumen técnico de un error no controlado (Prisma/Postgres u otro): tipo,
// código Prisma (P2002…), código y detalle de Postgres si vienen en el mensaje,
// y la ruta + reqId para cruzarlo con el log de Coolify.
function debugError(error: unknown, request: { id: string; method: string; url: string }) {
  const e = error as { name?: string; message?: string; code?: unknown; meta?: unknown; clientVersion?: unknown }
  const mensaje = (e?.message ?? String(error)).replace(/\s+/g, ' ').trim()
  const pg = /code: "(\w+)", message: "([^"]*)"(?:.*?detail: Some\("([^"]*)"\))?/.exec(mensaje)
  return {
    reqId: request.id,
    ruta: `${request.method} ${request.url}`,
    tipo: e?.name ?? typeof error,
    ...(typeof e?.code === 'string' ? { codigo: e.code } : {}),
    ...(e?.meta != null ? { meta: e.meta } : {}),
    ...(pg ? { postgres: { codigo: pg[1], mensaje: pg[2], ...(pg[3] ? { detalle: pg[3] } : {}) } } : {}),
    mensaje: mensaje.length > 1500 ? `${mensaje.slice(0, 1500)}…` : mensaje,
  }
}
