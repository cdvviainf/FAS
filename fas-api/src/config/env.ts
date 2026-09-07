import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('noreply@agrosan.cl'),
  DTE_PROVIDER: z.enum(['mock', 'chilesystems', 'simplefactura']).default('mock'),
  // Solicitud de Reserva de espacio (ventas.md §4.3) — 'mock' simula una
  // respuesta exitosa sin llamar a nada externo. En 'agl360', la URL y el
  // token YA NO viven acá — se configuran en el mantenedor de Integraciones
  // (Configuración → Integraciones, código 'AGL360', Docs/integraciones.md)
  // para poder editarse por empresa sin redeploy.
  AGL_PROVIDER: z.enum(['mock', 'agl360']).default('mock'),
  // Autentica el webhook ENTRANTE (AGL360 -> FAS, Docs/webhook-fas.md): el
  // secreto compartido con el que se verifica el HMAC-SHA256 del header
  // `X-AGL360-Signature` sobre el body crudo. Sin esto configurado, el
  // webhook rechaza toda llamada (fail-closed). Es distinto de la credencial
  // SALIENTE (el TOKEN que FAS manda a AGL360), que vive en Integraciones —
  // este vive en env (no en Integraciones) porque hace falta ANTES de poder
  // resolver el tenant (el body no trae empresaId; se deriva de
  // `referencia_externa`, ver embarques.controller.ts), así que no puede
  // depender de una fila tenant-scoped para verificarse.
  AGL360_WEBHOOK_SECRET: z.string().min(16).optional(),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  // Motor de documentos (PDF, Etapa 4 — Docs/agrosan_etapa4_motor_documentos.md):
  // en producción (imagen Alpine) apunta al Chromium del sistema instalado vía
  // `apk add chromium` (Playwright no distribuye binario musl/ARM-friendly
  // propio para Alpine). En desarrollo se deja vacío y Playwright usa el
  // Chromium que instala `npx playwright install chromium`.
  PLAYWRIGHT_EXECUTABLE_PATH: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
export type Env = typeof env
