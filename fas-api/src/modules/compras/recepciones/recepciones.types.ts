export interface RecepcionCreateInput {
  ordenCompraId?: number | null
  esProceso?: boolean
  plantaId: number
  direccionPlantaId: number
  templateCargaId?: number | null
  observaciones?: string | null
}

// origen (derivado de ordenCompraId/esProceso) se fija solo al crear — no
// forma parte del PATCH.
export type RecepcionUpdateInput = Partial<Omit<RecepcionCreateInput, 'ordenCompraId' | 'esProceso'>>
