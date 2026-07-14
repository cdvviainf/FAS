import { createMantenedorService } from './service'
import type { MantenedorSimpleCreateInput } from './types'

export function createMantenedorMutations(recurso: string) {
  const svc = createMantenedorService(recurso)
  return {
    create: { mutationFn: (data: MantenedorSimpleCreateInput) => svc.create(data) },
    update: {
      mutationFn: ({
        id,
        values
      }: {
        id: number
        values: Partial<MantenedorSimpleCreateInput>
      }) => svc.update(id, values)
    },
    remove: { mutationFn: (id: number) => svc.remove(id) }
  }
}
