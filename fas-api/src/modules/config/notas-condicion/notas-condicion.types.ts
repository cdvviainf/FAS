export interface NotaCondicionCreateInput {
  codigo: string
  descripcion: string
  descripcionExtranjera?: string
  orden?: number
  especieIds: number[]
}

export type NotaCondicionUpdateInput = Partial<Omit<NotaCondicionCreateInput, 'codigo'>> & { bloqueado?: boolean }
