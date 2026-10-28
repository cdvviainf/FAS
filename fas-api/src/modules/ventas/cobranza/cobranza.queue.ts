import type { Job } from 'bullmq'
import { cobranzaQueue, createWorker } from '../../../lib/queue.js'
import { empresaContext } from '../../../lib/empresa-context.js'
import { logger } from '../../../lib/logger.js'
import * as repo from './pago.repository.js'
import { inicioDeHoy } from './cobranza-estado.js'

// Cobranza — Ciclo 3 (Docs/cobranza.md): barrido diario que marca VENCIDA las
// cuotas/facturas impagas cuyo vencimiento ya pasó (CB14/CB15). Primer job
// programado (cron) del sistema; mismo esqueleto de cola que correos/auditoría.

const JOB_VENCIDAS = 'marcar-vencidas'
const SCHEDULER_ID = 'cobranza-vencimientos-diario'
// Zona horaria del cliente (Chile). El barrido corre de madrugada; el día lo
// resuelve inicioDeHoy() al ejecutar.
const CRON_DIARIO = '0 3 * * *' // 03:00 todos los días
const TZ = 'America/Santiago'

// Opciones de cada corrida del cron: reintentos con backoff (el barrido es
// idempotente — recalcular el mismo estado no produce cambios —, así que
// reintentarlo completo tras una falla transitoria es seguro, FAS-COB-VEN-R2-003)
// + retención acotada para no acumular jobs del scheduler.
const JOB_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 60_000 },
  removeOnComplete: 50,
  removeOnFail: 100,
} as const

// Programa (idempotente) el barrido diario. upsertJobScheduler reemplaza el
// schedule existente, así que re-invocar en cada arranque no duplica jobs.
export async function programarVencimientosDiarios() {
  await cobranzaQueue.upsertJobScheduler(
    SCHEDULER_ID,
    { pattern: CRON_DIARIO, tz: TZ },
    { name: JOB_VENCIDAS, data: {}, opts: JOB_OPTS },
  )
}

// Recorre todas las empresas activas y refresca su cartera bajo el contexto de
// cada una (los updates de factura son de un modelo tenant → requieren el
// empresaContext; sin él prisma-tenancy no filtraría). Un fallo de una empresa
// NO aborta a las demás (FAS-COB-VEN-R1-002): se registra y se continúa; si al
// menos una falló, el job termina con error para que BullMQ reintente/alerte.
async function procesarVencidas() {
  const hoy = inicioDeHoy()
  const empresas = await repo.getEmpresasActivas()
  const totales = { facturas: 0, cuotas: 0 }
  const fallidas: number[] = []
  for (const e of empresas) {
    try {
      const r = await empresaContext.run({ empresaId: e.id }, () => repo.refrescarCarteraEmpresaActual(hoy))
      totales.facturas += r.facturas
      totales.cuotas += r.cuotas
    } catch (err) {
      fallidas.push(e.id)
      logger.error({ empresaId: e.id, err: err instanceof Error ? err.message : String(err) }, 'Cobranza: falló el barrido de una empresa')
    }
  }
  logger.info({ ...totales, empresas: empresas.length, fallidas: fallidas.length }, 'Cobranza: barrido diario de vencimientos completado')
  if (fallidas.length > 0) {
    // Falla el job (tras procesar todas) para activar el reintento/alerta de BullMQ.
    throw new Error(`Barrido de vencimientos: ${fallidas.length} empresa(s) fallaron (${fallidas.join(', ')})`)
  }
  return totales
}

// Registra el worker de la cola de cobranza. Llamar una vez al iniciar el server.
export function iniciarWorkerCobranza() {
  return createWorker('cobranza', async (job: Job) => {
    if (job.name === JOB_VENCIDAS) return procesarVencidas()
    logger.warn({ jobName: job.name }, 'Cobranza: job desconocido ignorado')
  })
}
