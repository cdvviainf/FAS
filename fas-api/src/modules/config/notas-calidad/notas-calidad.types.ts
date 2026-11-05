export interface NotaCalidadCreateInput {
  codigo: string
  descripcion: string
  descripcionExtranjera?: string
  orden?: number
  especieIds: number[]
}

export type NotaCalidadUpdateInput = Partial<Omit<NotaCalidadCreateInput, 'codigo'>> & { bloqueado?: boolean }
