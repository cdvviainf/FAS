import { api } from '@/lib/api'
import type { PrefijoCodigo, PrefijoCodigoCreateInput, PrefijoCodigoUpdateInput } from './types'

export const prefijosCodigoService = {
  async list(): Promise<{ data: PrefijoCodigo[] }> {
    return api.get('config/prefijos-codigo').json()
  },
  async create(data: PrefijoCodigoCreateInput): Promise<{ data: PrefijoCodigo }> {
    return api.post('config/prefijos-codigo', { json: data }).json()
  },
  async update(id: number, data: PrefijoCodigoUpdateInput): Promise<{ data: PrefijoCodigo }> {
    return api.patch(`config/prefijos-codigo/${id}`, { json: data }).json()
  },
  async remove(id: number): Promise<void> {
    await api.delete(`config/prefijos-codigo/${id}`)
  },
  // Sugerencia de siguiente código para `modelo` — null si no hay prefijo
  // configurado. No lanza si el fetch falla (deja el campo vacío, editable).
  async siguienteCodigo(modelo: string): Promise<string | null> {
    try {
      const res = await api.get(`config/prefijos-codigo/siguiente/${modelo}`).json<{ data: { codigo: string | null } }>()
      return res.data.codigo
    } catch {
      return null
    }
  },
}
