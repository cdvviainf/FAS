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
  // Escala (menor = mejor) para la regla "hasta" del Cierre Comercial.
  orden: number
  bloqueado: boolean
  especies: NotaCondicionEspecie[]
}

export interface NotaCondicionCreateInput {
  codigo: string
  descripcion: string
  descripcionExtranjera?: string
  orden?: number
  especieIds: number[]
}

export type NotaCondicionUpdateInput = Partial<Omit<NotaCondicionCreateInput, 'codigo'>> & { bloqueado?: boolean }
