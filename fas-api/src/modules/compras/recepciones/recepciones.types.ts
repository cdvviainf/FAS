export interface RecepcionCreateInput {
  ordenCompraId?: number | null
  plantaId: number
  direccionPlantaId: number
  templateCargaId?: number | null
  observaciones?: string | null
}

export type RecepcionUpdateInput = Partial<Omit<RecepcionCreateInput, 'ordenCompraId'>>
