export interface NotaCondicionCreateInput {
  codigo: string
  descripcion: string
  descripcionExtranjera?: string
  especieIds: number[]
}

export type NotaCondicionUpdateInput = Partial<Omit<NotaCondicionCreateInput, 'codigo'>> & { bloqueado?: boolean }
