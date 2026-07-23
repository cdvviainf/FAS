import { encrypt } from '../../../lib/crypto.js'
import { enviarCorreo, invalidateMailer } from '../../../lib/mailer.js'
import { ValidationError } from '../../../shared/errors.js'
import * as repo from './correo.repository.js'
import type { CorreoConfigBody } from './correo.schema.js'

/** Nunca expone la password: solo indica si hay una guardada. */
export async function obtenerConfiguracion() {
  const config = await repo.getConfiguracionCorreo()
  if (!config) return null
  const { passwordCifrada: _omitida, ...rest } = config
  return { ...rest, tienePassword: true }
}

export async function guardarConfiguracion(body: CorreoConfigBody, userId: string) {
  const existente = await repo.getConfiguracionCorreo()

  let passwordCifrada: string
  if (body.password) {
    passwordCifrada = encrypt(body.password)
  } else if (existente) {
    passwordCifrada = existente.passwordCifrada
  } else {
    throw new ValidationError('La contraseña es obligatoria en la configuración inicial')
  }

  const { password: _plain, ...rest } = body
  const saved = await repo.upsertConfiguracionCorreo({ ...rest, passwordCifrada }, userId)
  invalidateMailer()
  const { passwordCifrada: _omitida, ...safe } = saved
  return { ...safe, tienePassword: true }
}

export async function enviarCorreoPrueba(destinatario: string) {
  await enviarCorreo({
    to: [destinatario],
    subject: 'FAS — Correo de prueba',
    html: `<p>Este es un correo de prueba del sistema FAS (Frutera Agrosan).</p>
<p>Si lo recibiste, la configuración SMTP es correcta.</p>`,
  })
}
