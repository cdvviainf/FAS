import type { Job } from 'bullmq'
import { createQueue, createWorker } from '../../lib/queue.js'
import { enviarCorreo } from '../../lib/mailer.js'

export interface CorreoJobData {
  to: string[]
  subject: string
  html: string
}

export interface RecordatorioJobData {
  solicitudId: number
}

export const correosQueue = createQueue('correos')

const opcionesBase = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 30_000 },
  removeOnComplete: 100,
  removeOnFail: 500,
} as const

/** Encola un correo con reintentos exponenciales; el envío nunca bloquea el request. */
export async function encolarCorreo(data: CorreoJobData) {
  await correosQueue.add('enviar', data, opcionesBase)
}

/**
 * Encola un recordatorio diferido de solicitud de inspección.
 * jobId determinístico: reprogramar reemplaza el job anterior.
 * El contenido del correo se construye al momento del envío (datos vigentes).
 */
export async function encolarCorreoDiferido(jobId: string, data: RecordatorioJobData, delayMs: number) {
  const existing = await correosQueue.getJob(jobId)
  if (existing) await existing.remove()
  await correosQueue.add('recordatorio-solicitud', data, { ...opcionesBase, jobId, delay: delayMs })
}

/** Cancela un correo diferido programado (si existe). */
export async function cancelarCorreoDiferido(jobId: string) {
  const existing = await correosQueue.getJob(jobId)
  if (existing) await existing.remove()
}

/** Registra el worker que procesa la cola de correos. Llamar una vez al iniciar el server. */
export function iniciarWorkerCorreos() {
  return createWorker('correos', async (job: Job) => {
    if (job.name === 'recordatorio-solicitud') {
      // Import dinámico para evitar dependencia circular con el módulo de solicitudes
      const { procesarRecordatorio } = await import('../calidad/solicitudes/solicitudes.service.js')
      await procesarRecordatorio((job.data as RecordatorioJobData).solicitudId)
      return
    }
    await enviarCorreo(job.data as CorreoJobData)
  })
}
