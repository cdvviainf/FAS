import { api } from '@/lib/api'
import type { CajasPorPallet, CajasPorPalletCreateInput, CajasPorPalletUpdateInput } from './types'

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
  // Lookup para auto-completar cajasPorPallet al elegir embalaje + tipo de pallet.
  async buscar(articuloId: number, tipoPalletId: number): Promise<{ cajasPorPallet: number } | null> {
    const res = await api
      .get('config/cajas-por-pallet/buscar', { searchParams: { articuloId: String(articuloId), tipoPalletId: String(tipoPalletId) } })
      .json<{ data: { cajasPorPallet: number } | null }>()
    return res.data
  },
}
