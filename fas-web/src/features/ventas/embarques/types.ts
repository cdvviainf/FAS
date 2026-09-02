export interface EmbarqueNotaVentaRef {
  id: number
  folio: number
}

export interface MantenedorRef {
  id: number
  codigo: string
  descripcion: string
}

export interface EntidadRef {
  id: number
  codigo: string
  descripcion: string
}

// Origen de un Pallet (compras.md §4.4/§4.5) — de qué OC (modo COMPRA) o de
// qué Instructivo(s) de Embalaje (modo PROCESO) viene, para la trazabilidad
// Cierre Comercial ↔ Embarque ↔ Pallet (2026-09-02).
export interface PalletOrigenRecepcion {
  ordenCompra: { id: number; numero: string } | null
  instructivos: Array<{ instructivo: { id: number; numero: number } }>
}

export interface PalletLineaResumen {
  especieId: number
  especie: MantenedorRef
  variedadId: number
  variedad: MantenedorRef
  categoriaId: number
  categoria: MantenedorRef
  articuloId: number
  articulo: MantenedorRef
  calibreId: number
  calibre: MantenedorRef
  cajas: number
}

export interface PalletResumen {
  id: number
  numeroPallet: string
  origen: 'COMPRA' | 'CONSIGNACION' | 'PROCESO'
  productor: EntidadRef
  recepcion: PalletOrigenRecepcion
  lineas: PalletLineaResumen[]
}

export interface Embarque {
  id: number
  notaVentaId: number
  notaVenta: EmbarqueNotaVentaRef
  numeroInstructivo: string
  despachadoEn: string | null
  despachadoPor: string | null
  creadoEn: string
  _count: { pallets: number }
}

export interface EmbarqueDetalle extends Omit<Embarque, '_count'> {
  pallets: PalletResumen[]
}

// numeroInstructivo ya no se ingresa manualmente (2026-08-13, ventas.md R10):
// se calcula en el backend a partir del folio de la NV y el prefijo
// configurado para su Tipo de Embarque.
export interface EmbarqueCreateInput {
  notaVentaId: number
}

export interface EmbarqueListResponse {
  data: Embarque[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}
