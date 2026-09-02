export interface NotaCalidadCreateInput {
  codigo: string
  descripcion: string
  descripcionExtranjera?: string
  especieIds: number[]
}

export type NotaCalidadUpdateInput = Partial<Omit<NotaCalidadCreateInput, 'codigo'>> & { bloqueado?: boolean }
