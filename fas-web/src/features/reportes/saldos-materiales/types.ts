import type { TipoArticulo } from '@/features/materiales/articulos/types'

// Una fila = un SaldoArticulo (Artículo x Bodega) — ya es el grano más fino
// posible, a diferencia de Stock de Fruta (que abre por pallet dentro de
// cada combinación especie/variedad/calibre/categoría): acá no hay nada más
// que expandir, por eso la grilla es plana (fas-api/movimientos.repository.ts#listSaldos).
export interface SaldoMaterialRow {
  articuloId: number
  bodegaId: number
  cantidad: number
  costoPromedio: number
  articulo: {
    id: number
    codigo: string
    descripcion: string
    tipo: TipoArticulo
    stockCritico: number | null
    controlaStock: boolean
    unidad: { id: number; codigo: string; descripcion: string }
  }
  bodega: { id: number; codigo: string; descripcion: string }
}
