import type { Job } from 'bullmq'
import { createQueue, createWorker } from '../../lib/queue.js'
import { enviarCorreo } from '../../lib/mailer.js'
import { empresaContext } from '../../lib/empresa-context.js'

export interface CorreoJobData {
  to: string[]
  subject: string
  html: string
  // Empresa activa al momento de encolar (Fase 2: ConfiguracionCorreo es por
  // empresa) — el worker corre fuera de cualquier request, así que necesita
  // que el job cargue este dato para resolver el SMTP correcto.
  empresaId: number | null
}

export interface RecordatorioJobData {
  solicitudId: number
  empresaId: number | null
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
    // El worker corre fuera de cualquier request Fastify — sin este `run`,
    // getEmpresaIdActual() vería el store ausente y prisma-tenancy.ts no
    // aplicaría ningún filtro sobre ConfiguracionCorreo (en vez de fallar
    // ruidosamente, quedaría "sin enforcement" — por eso el job SIEMPRE debe
    // establecer el contexto, aunque empresaId venga null).
    return empresaContext.run({ empresaId: (job.data as { empresaId: number | null }).empresaId }, async () => {
      if (job.name === 'recordatorio-solicitud') {
        // Import dinámico para evitar dependencia circular con el módulo de solicitudes
        const { procesarRecordatorio } = await import('../calidad/solicitudes/solicitudes.service.js')
        await procesarRecordatorio((job.data as RecordatorioJobData).solicitudId)
        return
      }
      await enviarCorreo(job.data as CorreoJobData)
    })
  })
}
