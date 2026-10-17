import { env } from './config/env.js'
import { iniciarWorkerCorreos } from './modules/correos/correos.queue.js'
import { iniciarWorkerAuditoria } from './modules/auditoria/auditoria.queue.js'
import { buildApp } from './app.js'

const app = await buildApp()

// Worker de cola de correos (envíos y recordatorios en background)
const workerCorreos = iniciarWorkerCorreos()
workerCorreos.on('failed', (job, err) => {
  app.log.error({ jobId: job?.id, jobName: job?.name, err: err.message }, 'Job de correo falló')
})

// Worker de cola de auditoría (persiste los eventos de trazabilidad)
const workerAuditoria = iniciarWorkerAuditoria()
workerAuditoria.on('failed', (job, err) => {
  app.log.error({ jobId: job?.id, jobName: job?.name, err: err.message }, 'Job de auditoría falló')
})

await app.listen({ port: env.PORT, host: '0.0.0.0' })
