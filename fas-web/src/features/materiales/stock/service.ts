import { api } from '@/lib/api'
import type { ResultadoConsultaStock, EmbalajeCantidad } from './types'

export const stockService = {
  async consultaStockReceta(embalajes: EmbalajeCantidad[], bodegaIds: number[]): Promise<{ data: ResultadoConsultaStock[] }> {
    return api.post('materiales/consulta-stock-receta', { json: { embalajes, bodegaIds } }).json()
  },
}
