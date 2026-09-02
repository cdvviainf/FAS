export interface EspecieRef {
  id: number
  codigo: string
  descripcion: string
}

export interface NotaCondicionEspecie {
  id: number
  especieId: number
  especie: EspecieRef
}

export interface NotaCondicion {
  id: number
  codigo: string
  descripcion: string
  descripcionExtranjera?: string | null
  bloqueado: boolean
  especies: NotaCondicionEspecie[]
}

export interface NotaCondicionCreateInput {
  codigo: string
  descripcion: string
  descripcionExtranjera?: string
  especieIds: number[]
}

export type NotaCondicionUpdateInput = Partial<Omit<NotaCondicionCreateInput, 'codigo'>> & { bloqueado?: boolean }
