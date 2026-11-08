import type { Job } from 'bullmq'
import { dteSeguimientoQueue, createWorker } from '../../../lib/queue.js'
import { empresaContext } from '../../../lib/empresa-context.js'
import { logger } from '../../../lib/logger.js'
import { env } from '../../../config/env.js'
import { getEmpresasActivas } from './pago.repository.js'
import { getFacturasNacionalEnviadasSii } from './factura-nacional.repository.js'
import { getFacturasExportacionEnviadasSii } from './factura-exportacion.repository.js'
import { getDocumentosDteSiiPendientes } from '../../finanzas/facturacion/dte-emitidos.repository.js'

// Seguimiento automático del veredicto del SII, POR DOCUMENTO. Al timbrar, una
// factura (Nacional o Exportación) queda ENVIADA_SII; el SII tarda minutos/horas
// en pronunciarse. En vez de un barrido global, cada factura agenda su propio
// job que se re-agenda mientras siga ENVIADA_SII y se detiene al llegar a
// APROBADA/RECHAZADA — ahí termina su ciclo. El botón manual "Consultar estado
// SII" se conserva como disparo inmediato.
//
// Factura Nacional (33/34) y Exportación (110) siguen por su estado ENVIADA_SII.
// Desde el Monitor DTE (2026-11-07) también se sigue el veredicto de guías (52) y
// notas de crédito (61/112) con el tipo 'documento-dte': ahí `facturaId` es el id
// del DocumentoDte y el estado vive en documentos_dte.estadoSii.

export type TipoSeguimientoSii = 'factura-nacional' | 'factura-exportacion' | 'documento-dte'
type VeredictoSii = 'ACEPTADO' | 'RECHAZADO' | 'PENDIENTE'

// Handler por tipo: la función consultarEstadoSii(id) del módulo correspondiente.
// Inyectado desde server.ts para no acoplar esta cola a los services (evita
// import circular: services → esta cola (encolar); esta cola NO importa services).
export type HandlerSii = (facturaId: number) => Promise<{ sii: { veredicto: VeredictoSii } }>
export type HandlersSii = Record<TipoSeguimientoSii, HandlerSii>

const JOB_SEGUIR = 'seguir-sii'
// Primera consulta poco después de timbrar (el SII suele responder en minutos).
const DELAY_INICIAL_MS = 2 * 60_000
// Reintentos espaciados mientras no haya veredicto.
const INTERVALO_MS = 15 * 60_000
// Tope de consultas antes de rendirse (~24 h). Tras esto, el botón manual sigue.
const MAX_INTENTOS = 96

const JOB_OPTS = {
  removeOnComplete: true,
  removeOnFail: 50,
} as const

interface SeguimientoJobData {
  tipo: TipoSeguimientoSii
  facturaId: number
  empresaId: number
  intento: number
}

// Sin ':' — BullMQ rechaza jobIds con ':' salvo que tengan exactamente 3
// segmentos (job.js: "Custom Id cannot contain :"). Usamos '_' como separador.
function jobId(tipo: TipoSeguimientoSii, facturaId: number, intento: number) {
  return `sii_${tipo}_${facturaId}_${intento}`
}

async function agendar(data: SeguimientoJobData, delay: number) {
  await dteSeguimientoQueue.add(JOB_SEGUIR, data, {
    jobId: jobId(data.tipo, data.facturaId, data.intento),
    delay,
    ...JOB_OPTS,
  })
}

// Encola el seguimiento de una factura recién timbrada (intento 0). No-op en mock
// (sin proveedor real no hay nada que consultar). jobId determinístico ⇒ un doble
// llamado al mismo (tipo, factura) no crea dos cadenas.
export async function encolarSeguimientoSii(input: { tipo: TipoSeguimientoSii; facturaId: number; empresaId: number }) {
  if (env.DTE_PROVIDER !== 'libredte') return
  await agendar({ ...input, intento: 0 }, DELAY_INICIAL_MS)
  logger.info({ ...input }, 'Seguimiento SII: encolado')
}

// Worker: consulta el veredicto; si es terminal (APROBADA/RECHAZADA) detiene la
// cadena, si sigue PENDIENTE (o la consulta falla transitoriamente) la re-agenda
// hasta MAX_INTENTOS. Corre bajo el contexto de empresa de la factura (los
// updates son de modelos tenant → requieren empresaContext).
export function iniciarWorkerSeguimientoSii(handlers: HandlersSii) {
  return createWorker('dte-seguimiento', async (job: Job<SeguimientoJobData>) => {
    if (job.name !== JOB_SEGUIR) {
      logger.warn({ jobName: job.name }, 'Seguimiento SII: job desconocido ignorado')
      return
    }
    const { tipo, facturaId, empresaId, intento } = job.data
    const handler = handlers[tipo]
    if (!handler) {
      logger.warn({ tipo }, 'Seguimiento SII: tipo sin handler, se detiene')
      return
    }

    let veredicto: VeredictoSii = 'PENDIENTE'
    try {
      const r = await empresaContext.run({ empresaId }, () => handler(facturaId))
      veredicto = r.sii.veredicto
    } catch (err) {
      // Consulta fallida (transitorio de red/LibreDTE): se trata como PENDIENTE y
      // se reintenta en el próximo intento, sin romper el job.
      logger.warn(
        { tipo, facturaId, intento, err: err instanceof Error ? err.message : String(err) },
        'Seguimiento SII: consulta falló, se reintentará',
      )
    }

    if (veredicto === 'ACEPTADO' || veredicto === 'RECHAZADO') {
      logger.info({ tipo, facturaId, veredicto }, 'Seguimiento SII: veredicto final, ciclo terminado')
      return
    }
    if (intento + 1 >= MAX_INTENTOS) {
      logger.warn({ tipo, facturaId, intentos: intento + 1 }, 'Seguimiento SII: sin veredicto tras el máximo de intentos, se detiene (queda la consulta manual)')
      return
    }
    await agendar({ tipo, facturaId, empresaId, intento: intento + 1 }, INTERVALO_MS)
  })
}

// Resync de arranque: re-encola el seguimiento de todas las facturas que quedaron
// ENVIADA_SII (p. ej. las emitidas antes de esta feature, o cadenas que se
// rindieron). Los jobs con delay en curso persisten en Redis y se retoman solos
// tras un reinicio; esto cubre el resto. No es un barrido recurrente: corre una
// sola vez al iniciar el server.
export async function reencolarSeguimientosPendientes() {
  if (env.DTE_PROVIDER !== 'libredte') return
  // Dedupe (FAS-COB-SII-R1-001): los jobs con delay de una cadena en curso
  // persisten en Redis y se retoman solos tras el reinicio. Sin este chequeo, el
  // resync encolaría un intento 0 nuevo para esa misma factura (el jobId lleva el
  // `intento`, así que no colisiona con el job demorado) y quedarían dos cadenas
  // consultando el mismo DTE. Se arma una vez el set de (tipo:factura) que YA
  // tienen un job en la cola y se omiten.
  const jobsActivos = await dteSeguimientoQueue.getJobs(['delayed', 'waiting', 'active', 'paused', 'waiting-children'])
  const yaEncolados = new Set(
    jobsActivos
      .map((j) => j.data as SeguimientoJobData | undefined)
      .filter((d): d is SeguimientoJobData => !!d && d.tipo != null && d.facturaId != null)
      .map((d) => `${d.tipo}:${d.facturaId}`),
  )

  const empresas = await getEmpresasActivas()
  let total = 0
  for (const e of empresas) {
    const pendientes = await empresaContext.run({ empresaId: e.id }, async () => {
      const [nac, exp, docs] = await Promise.all([
        getFacturasNacionalEnviadasSii(),
        getFacturasExportacionEnviadasSii(),
        getDocumentosDteSiiPendientes(),
      ])
      return [
        ...nac.map((f) => ({ tipo: 'factura-nacional' as const, facturaId: f.id, empresaId: f.empresaId })),
        ...exp.map((f) => ({ tipo: 'factura-exportacion' as const, facturaId: f.id, empresaId: f.empresaId })),
        ...docs.map((d) => ({ tipo: 'documento-dte' as const, facturaId: d.id, empresaId: d.empresaId })),
      ]
    })
    for (const p of pendientes) {
      if (yaEncolados.has(`${p.tipo}:${p.facturaId}`)) continue
      // Aislar errores por factura: un fallo de encolado no debe abortar el
      // arranque del server (reencolar se await-ea antes de app.listen).
      try {
        await encolarSeguimientoSii(p)
        total++
      } catch (err) {
        logger.warn({ ...p, err: err instanceof Error ? err.message : String(err) }, 'Seguimiento SII: no se pudo reencolar una factura en el resync (se omite)')
      }
    }
  }
  if (total > 0) logger.info({ total }, 'Seguimiento SII: resync de arranque encolado')
}
