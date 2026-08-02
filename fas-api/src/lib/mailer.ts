import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { prisma } from './prisma.js'
import { decrypt } from './crypto.js'
import { getEmpresaIdActual } from './empresa-context.js'
import { BusinessError } from '../shared/errors.js'

// Transport cacheado por empresa (Fase 2: ConfiguracionCorreo es por-empresa)
// — se invalida entero cuando se actualiza cualquier configuración SMTP.
const transportCache = new Map<number, { transport: Transporter; from: string }>()

export function invalidateMailer() {
  transportCache.clear()
}

async function getTransport(): Promise<{ transport: Transporter; from: string }> {
  const empresaId = getEmpresaIdActual()
  if (empresaId != null) {
    const cached = transportCache.get(empresaId)
    if (cached) return cached
  }

  // Sin `where` explícito: la extensión de tenancy (prisma-tenancy.ts)
  // inyecta empresaId — o lanza EMPRESA_REQUERIDA si no hay una activa.
  const config = await prisma.configuracionCorreo.findFirst({ orderBy: { id: 'desc' } })
  if (!config) {
    throw new BusinessError(
      'SMTP_NO_CONFIGURADO',
      'No hay configuración SMTP. Configúrala en Configuración › Configuración General.',
      503,
    )
  }

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.puerto,
    secure: config.seguridad === 'SSL', // SSL implícito (465); STARTTLS se negocia sobre conexión plana
    requireTLS: config.seguridad === 'STARTTLS',
    auth: {
      user: config.usuario,
      pass: decrypt(config.passwordCifrada),
    },
  })

  const from = `"${config.remitenteNombre}" <${config.remitenteEmail}>`
  if (empresaId != null) transportCache.set(empresaId, { transport, from })
  return { transport, from }
}

export interface EnviarCorreoInput {
  to: string[]
  subject: string
  html: string
}

export async function enviarCorreo({ to, subject, html }: EnviarCorreoInput) {
  const { transport, from } = await getTransport()
  await transport.sendMail({ from, to: to.join(', '), subject, html })
}

/** Verifica la conexión SMTP con la configuración actual (para el botón "probar"). */
export async function verificarSmtp() {
  const { transport } = await getTransport()
  await transport.verify()
}
