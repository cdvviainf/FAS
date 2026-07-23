import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { prisma } from './prisma.js'
import { decrypt } from './crypto.js'
import { BusinessError } from '../shared/errors.js'

// Transport cacheado — se invalida cuando se actualiza la configuración SMTP
let cachedTransport: Transporter | null = null
let cachedFrom: string | null = null

export function invalidateMailer() {
  cachedTransport = null
  cachedFrom = null
}

async function getTransport(): Promise<{ transport: Transporter; from: string }> {
  if (cachedTransport && cachedFrom) return { transport: cachedTransport, from: cachedFrom }

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

  cachedTransport = transport
  cachedFrom = `"${config.remitenteNombre}" <${config.remitenteEmail}>`
  return { transport, from: cachedFrom }
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
