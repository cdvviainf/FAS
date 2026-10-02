import pino from 'pino'

// Logger compartido para código fuera del scope de una request Fastify
// (adapters, armado de payloads, jobs). En producción escribe JSON a stdout →
// visible en los logs del contenedor (Coolify). El nivel se controla por
// LOG_LEVEL; por defecto 'info' en producción y 'debug' en desarrollo.
export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
})
