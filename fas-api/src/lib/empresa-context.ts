import { AsyncLocalStorage } from 'node:async_hooks'

// Contexto de empresa activa por request (multi-empresa, Fase 1). El store se
// inicializa vacío en un hook `onRequest` global (ver app.ts) y se muta —no se
// reemplaza— dentro de `requireAuth` una vez resuelto el valor real, para que
// la referencia persista a través de todo el ciclo del request (incluida la
// capa de repositorio, que en Fase 2 leerá esto vía Prisma Client Extension
// sin depender de `request`).
export interface EmpresaStore {
  empresaId: number | null
  // Temporada activa del selector superior (cabecera X-Temporada-Id,
  // 2026-11-16): rige todo lo que el usuario registra. Se valida al usarla
  // (temporada-documento.ts), no en el guard.
  temporadaId?: number | null
  // true solo en el store que abre el hook onRequest de un request HTTP. Los
  // contextos abiertos a mano (jobs, scripts, tests) no lo tienen y pueden
  // resolver la temporada por fecha.
  esHttp?: boolean
}

export const empresaContext = new AsyncLocalStorage<EmpresaStore>()

export function getEmpresaIdActual(): number | null {
  return empresaContext.getStore()?.empresaId ?? null
}
