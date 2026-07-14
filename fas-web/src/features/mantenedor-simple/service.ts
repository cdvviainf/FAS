import { api } from '@/lib/api'
import type {
  MantenedorSimple,
  MantenedorSimpleListResponse,
  MantenedorSimpleFilters,
  MantenedorSimpleCreateInput
} from './types'

export function createMantenedorService(recurso: string) {
  const svc = {
    async list(filters: MantenedorSimpleFilters = {}): Promise<MantenedorSimpleListResponse> {
      const params: Record<string, string> = {}
      if (filters.q) params.q = filters.q
      if (filters.page) params.page = String(filters.page)
      if (filters.limit) params.limit = String(filters.limit)
      // FK filters
      if (filters.regionId) params.regionId = String(filters.regionId)
      if (filters.provinciaId) params.provinciaId = String(filters.provinciaId)
      if (filters.especieId) params.especieId = String(filters.especieId)
      if (filters.grupoVariedadId) params.grupoVariedadId = String(filters.grupoVariedadId)
      if (filters.tipoParametroId) params.tipoParametroId = String(filters.tipoParametroId)
      if (filters.grupoMercadoId) params.grupoMercadoId = String(filters.grupoMercadoId)
      if (filters.paisId) params.paisId = String(filters.paisId)
      if (filters.tipoEmbarqueId) params.tipoEmbarqueId = String(filters.tipoEmbarqueId)
      if (filters.contexto) params.contexto = filters.contexto
      if (filters.soloActivos !== undefined) params.soloActivos = String(filters.soloActivos)
      return api.get(`config/${recurso}`, { searchParams: params }).json()
    },
    async getById(id: number): Promise<MantenedorSimple> {
      return api.get(`config/${recurso}/${id}`).json()
    },
    async create(data: MantenedorSimpleCreateInput): Promise<MantenedorSimple> {
      return api.post(`config/${recurso}`, { json: data }).json()
    },
    async update(id: number, data: Partial<MantenedorSimpleCreateInput>): Promise<MantenedorSimple> {
      return api.patch(`config/${recurso}/${id}`, { json: data }).json()
    },
    async remove(id: number): Promise<void> {
      await api.delete(`config/${recurso}/${id}`)
    }
  }
  return svc
}

/** Async validator config for the `codigo` field — checks uniqueness on blur */
export function createCodigoValidator(recurso: string) {
  const service = createMantenedorService(recurso)
  return {
    onBlurAsync: async ({ value }: { value: string }) => {
      if (!value?.trim()) return undefined
      try {
        const result = await service.list({ q: value.trim(), limit: 50 })
        const exists = result.data.some(
          (item) => item.codigo.toLowerCase() === value.trim().toLowerCase()
        )
        return exists ? 'Este código ya está en uso' : undefined
      } catch {
        return undefined
      }
    },
    onBlurAsyncDebounceMs: 300,
  }
}
