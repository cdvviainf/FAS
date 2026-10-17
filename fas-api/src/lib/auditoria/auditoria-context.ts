import { AsyncLocalStorage } from 'node:async_hooks'
import type { EventoAuditoria } from '../../modules/auditoria/auditoria.types.js'

// Contexto de auditoría por request (módulo portable). Se inicializa vacío en el
// hook `onRequest` global (ver app.ts), anidado dentro del `run` de
// empresaContext, y se MUTA —no se reemplaza— dentro de `requireAuth` una vez
// resuelto el usuario. Así la extensión Prisma de auditoría puede leer quién
// ejecutó cada mutación sin depender del objeto `request`.
export interface AuditoriaStore {
  usuarioId: string | null
  usuarioEmail: string | null
  ip: string | null
  userAgent: string | null
  // Ruta del endpoint HTTP en curso (opcional, informativo en mutaciones).
  ruta: string | null
  // Buffer de eventos de mutación de este request: se publican en `onResponse`
  // solo si la respuesta fue exitosa (así una transacción revertida no deja
  // eventos fantasma — A-QA-004).
  pendientes: EventoAuditoria[]
}

export const auditoriaContext = new AsyncLocalStorage<AuditoriaStore>()

export function storeAuditoriaVacio(): AuditoriaStore {
  return { usuarioId: null, usuarioEmail: null, ip: null, userAgent: null, ruta: null, pendientes: [] }
}

export function getAuditoriaContext(): AuditoriaStore {
  return auditoriaContext.getStore() ?? storeAuditoriaVacio()
}
