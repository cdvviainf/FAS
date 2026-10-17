import type { Job } from 'bullmq'
import { createQueue, createWorker } from '../../lib/queue.js'
import { logger } from '../../lib/logger.js'
import * as repo from './auditoria.repository.js'
import type { EventoAuditoria } from './auditoria.types.js'

export const auditoriaQueue = createQueue('auditoria')

const opcionesBase = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 10_000 },
  removeOnComplete: 1000,
  removeOnFail: 2000,
} as const

// Encola un evento de auditoría. Fire-and-forget: si el encolado falla, se
// registra el error pero NUNCA se propaga (la auditoría no debe romper la
// operación de negocio que la originó).
export async function encolarAuditoria(evento: EventoAuditoria): Promise<void> {
  try {
    await auditoriaQueue.add('registrar', evento, opcionesBase)
  } catch (err) {
    logger.error({ err, accion: evento.accion, entidad: evento.entidad }, 'auditoría: no se pudo encolar el evento')
  }
}

// Registra el worker que persiste los eventos. Llamar una vez al iniciar el server.
export function iniciarWorkerAuditoria() {
  return createWorker('auditoria', async (job: Job) => {
    await repo.crear(job.data as EventoAuditoria)
  })
}
