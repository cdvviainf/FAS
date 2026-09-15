import { api } from '@/lib/api'
import type { CajasPorPallet, CajasPorPalletCreateInput, CajasPorPalletUpdateInput, MatrizEmbalajeRow } from './types'

export const cajasPorPalletService = {
  async list(params?: { articuloId?: number; tipoPalletId?: number; limit?: number }): Promise<{ data: CajasPorPallet[] }> {
    const sp: Record<string, string> = {}
    if (params?.articuloId) sp.articuloId = String(params.articuloId)
    if (params?.tipoPalletId) sp.tipoPalletId = String(params.tipoPalletId)
    if (params?.limit) sp.limit = String(params.limit)
    return api.get('config/cajas-por-pallet', { searchParams: sp }).json()
  },
  async create(data: CajasPorPalletCreateInput): Promise<{ data: CajasPorPallet }> {
    return api.post('config/cajas-por-pallet', { json: data }).json()
  },
  async update(id: number, data: CajasPorPalletUpdateInput): Promise<{ data: CajasPorPallet }> {
    return api.patch(`config/cajas-por-pallet/${id}`, { json: data }).json()
  },
  async remove(id: number): Promise<void> {
    await api.delete(`config/cajas-por-pallet/${id}`)
  },
  // Editor matriz: embalajes de la especie con su cantidad para el tipo de pallet.
  async matriz(especieId: number, tipoPalletId: number): Promise<{ data: MatrizEmbalajeRow[] }> {
    return api
      .get('config/cajas-por-pallet/matriz', { searchParams: { especieId: String(especieId), tipoPalletId: String(tipoPalletId) } })
      .json()
  },
  // Grabar la cantidad de un embalaje (crea o actualiza) — usado al salir del input.
  async upsert(articuloId: number, tipoPalletId: number, cajasPorPallet: number): Promise<void> {
    await api.post('config/cajas-por-pallet/upsert', { json: { articuloId, tipoPalletId, cajasPorPallet } })
  },
  // Lookup para auto-completar cajasPorPallet al elegir embalaje + tipo de pallet.
  async buscar(articuloId: number, tipoPalletId: number): Promise<{ cajasPorPallet: number } | null> {
    const res = await api
      .get('config/cajas-por-pallet/buscar', { searchParams: { articuloId: String(articuloId), tipoPalletId: String(tipoPalletId) } })
      .json<{ data: { cajasPorPallet: number } | null }>()
    return res.data
  },
}
