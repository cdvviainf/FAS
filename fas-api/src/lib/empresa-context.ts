import { AsyncLocalStorage } from 'node:async_hooks'

// Contexto de empresa activa por request (multi-empresa, Fase 1). El store se
// inicializa vacío en un hook `onRequest` global (ver app.ts) y se muta —no se
// reemplaza— dentro de `requireAuth` una vez resuelto el valor real, para que
// la referencia persista a través de todo el ciclo del request (incluida la
// capa de repositorio, que en Fase 2 leerá esto vía Prisma Client Extension
// sin depender de `request`).
export interface EmpresaStore {
  empresaId: number | null
}

export const empresaContext = new AsyncLocalStorage<EmpresaStore>()

export function getEmpresaIdActual(): number | null {
  return empresaContext.getStore()?.empresaId ?? null
}
