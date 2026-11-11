import type { Job } from 'bullmq'
import { createQueue, createWorker } from '../../lib/queue.js'
import { enviarCorreo } from '../../lib/mailer.js'
import type { AdjuntoCorreo } from '../../lib/mailer.js'
import { randomUUID } from 'node:crypto'
import { empresaContext } from '../../lib/empresa-context.js'
import * as repo from './correos.repository.js'

export interface CorreoJobData {
  to: string[]
  subject: string
  html: string
  // Empresa activa al momento de encolar (Fase 2: ConfiguracionCorreo es por
  // empresa) — el worker corre fuera de cualquier request, así que necesita
  // que el job cargue este dato para resolver el SMTP correcto.
  empresaId: number | null
  // PDF a adjuntar (opcional). NO se serializa el Buffer por Redis: solo el
  // descriptor (tipo de documento + id); el worker regenera el PDF con
  // documentos.service.obtenerPdf al momento del envío (igual criterio que el
  // job 'recordatorio-solicitud', que reconstruye su correo al enviar).
  pdf?: { tipo: string; id: number }
  // Visor de correos (2026-11-11): origen legible y, en el job, el registro
  // (CorreoEnviado) de ESTE destinatario.
  origen?: string | null
  correoId?: number
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

/**
 * Encola un correo con reintentos exponenciales; el envío nunca bloquea el request.
 * Visor de correos (2026-11-11): con empresa, se registra UNA fila por
 * destinatario y se envía un correo individual a cada uno (estado y reintento
 * por destinatario). Sin empresa (caso excepcional) se envía sin registrar.
 */
export async function encolarCorreo(data: CorreoJobData) {
  const destinatarios = [...new Set(data.to.map((d) => d.trim()).filter(Boolean))]
  if (destinatarios.length === 0) return
  if (data.empresaId == null) {
    await correosQueue.add('enviar', { ...data, to: destinatarios }, opcionesBase)
    return
  }
  const ids = await empresaContext.run({ empresaId: data.empresaId }, () =>
    repo.crearRegistros({
      lote: randomUUID(),
      destinatarios,
      asunto: data.subject,
      html: data.html,
      origen: data.origen ?? null,
      pdfTipo: data.pdf?.tipo ?? null,
      pdfId: data.pdf?.id ?? null,
    }),
  )
  // CE-QA-001: si falla el encolado de un destinatario, su registro queda
  // FALLIDO (reintentable) y se sigue con los demás; luego se informa el error.
  let primerError: unknown = null
  for (const [i, correoId] of ids.entries()) {
    try {
      await correosQueue.add('enviar', { ...data, to: [destinatarios[i]], correoId }, opcionesBase)
    } catch (err) {
      primerError ??= err
      await empresaContext.run({ empresaId: data.empresaId }, () =>
        repo.marcarNoEncolado(correoId, err instanceof Error ? err.message : String(err)),
      )
    }
  }
  if (primerError) throw primerError
}

/** Reintento de UN registro (casilla) del visor: mismo contenido y destinatario. */
export async function reencolarRegistro(registro: {
  id: number
  empresaId: number
  destinatario: string
  asunto: string
  html: string
  origen: string | null
  pdfTipo: string | null
  pdfId: number | null
}) {
  const data: CorreoJobData = {
    to: [registro.destinatario],
    subject: registro.asunto,
    html: registro.html,
    empresaId: registro.empresaId,
    origen: registro.origen,
    correoId: registro.id,
    ...(registro.pdfTipo && registro.pdfId != null ? { pdf: { tipo: registro.pdfTipo, id: registro.pdfId } } : {}),
  }
  try {
    await correosQueue.add('enviar', data, opcionesBase)
  } catch (err) {
    // CE-QA-001: el registro no queda PENDIENTE sin job.
    await repo.marcarNoEncolado(registro.id, err instanceof Error ? err.message : String(err))
    throw err
  }
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
      const data = job.data as CorreoJobData
      const intento = job.attemptsMade + 1
      try {
        await enviarJob(data)
      } catch (err) {
        if (data.correoId != null) {
          const final = intento >= (job.opts.attempts ?? 1)
          await repo.marcarError(data.correoId, err instanceof Error ? err.message : String(err), final)
        }
        throw err
      }
      if (data.correoId != null) await repo.marcarEnviado(data.correoId)
    })
  })
}

async function enviarJob(data: CorreoJobData) {
  // Adjunto PDF (obligatorio cuando viene el descriptor): se regenera acá, bajo
  // el empresaContext ya activo, para no serializar el Buffer por Redis. El PDF
  // se genera ANTES de enviar: si falla, se lanza el error para que BullMQ
  // reintente (attempts/backoff) — NO se manda el correo sin el adjunto pedido.
  let attachments: AdjuntoCorreo[] | undefined
  if (data.pdf) {
    if (data.empresaId == null) {
      throw new Error('No se puede adjuntar el PDF al correo: falta la empresa en el job')
    }
    const { obtenerPdf } = await import('../documentos/documentos.service.js')
    const { buffer, nombreArchivo } = await obtenerPdf(data.pdf.tipo, data.pdf.id, data.empresaId)
    attachments = [{ filename: nombreArchivo, content: buffer, contentType: 'application/pdf' }]
  }
  await enviarCorreo({ to: data.to, subject: data.subject, html: data.html, attachments })
}
