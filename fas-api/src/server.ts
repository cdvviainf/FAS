import { env } from './config/env.js'
import { iniciarWorkerCorreos } from './modules/correos/correos.queue.js'
import { iniciarWorkerAuditoria } from './modules/auditoria/auditoria.queue.js'
import { iniciarWorkerCobranza, programarVencimientosDiarios } from './modules/ventas/cobranza/cobranza.queue.js'
import { iniciarWorkerSeguimientoSii, reencolarSeguimientosPendientes, type HandlersSii } from './modules/ventas/cobranza/dte-seguimiento-sii.queue.js'
import * as facturaNacionalService from './modules/ventas/cobranza/factura-nacional.service.js'
import * as facturaExportacionService from './modules/ventas/cobranza/factura-exportacion.service.js'
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

// Worker + cron diario de cobranza (marca cuotas/facturas VENCIDA). El schedule
// se registra (idempotente) al arrancar.
const workerCobranza = iniciarWorkerCobranza()
workerCobranza.on('failed', (job, err) => {
  app.log.error({ jobId: job?.id, jobName: job?.name, err: err.message }, 'Job de cobranza falló')
})
await programarVencimientosDiarios()

// Worker de seguimiento automático del veredicto SII (Factura Nacional/Exportación).
// Los handlers (consultarEstadoSii de cada módulo) se inyectan acá para no acoplar
// la cola a los services. El resync de arranque retoma facturas que quedaron
// ENVIADA_SII (p. ej. emitidas antes de esta feature).
const handlersSii: HandlersSii = {
  'factura-nacional': (id) => facturaNacionalService.consultarEstadoSii(id),
  'factura-exportacion': (id) => facturaExportacionService.consultarEstadoSii(id),
}
const workerSeguimientoSii = iniciarWorkerSeguimientoSii(handlersSii)
workerSeguimientoSii.on('failed', (job, err) => {
  app.log.error({ jobId: job?.id, jobName: job?.name, err: err.message }, 'Job de seguimiento SII falló')
})
await reencolarSeguimientosPendientes()

await app.listen({ port: env.PORT, host: '0.0.0.0' })
