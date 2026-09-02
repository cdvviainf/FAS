export interface RecepcionCreateInput {
  ordenCompraId?: number | null
  esProceso?: boolean
  // Instructivos de Embalaje seleccionados — solo aplica en modo PROCESO
  // (2026-09-01, ver recepciones.schema.ts).
  instructivoIds?: number[]
  plantaId: number
  direccionPlantaId: number
  templateCargaId?: number | null
  observaciones?: string | null
}

// origen/instructivoIds (derivado de/asociado a ordenCompraId/esProceso) se
// fijan solo al crear — no forman parte del PATCH.
export type RecepcionUpdateInput = Partial<Omit<RecepcionCreateInput, 'ordenCompraId' | 'esProceso' | 'instructivoIds'>>
