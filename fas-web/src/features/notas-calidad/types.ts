export interface EspecieRef {
  id: number
  codigo: string
  descripcion: string
}

export interface NotaCalidadEspecie {
  id: number
  especieId: number
  especie: EspecieRef
}

export interface NotaCalidad {
  id: number
  codigo: string
  descripcion: string
  descripcionExtranjera?: string | null
  bloqueado: boolean
  especies: NotaCalidadEspecie[]
}

export interface NotaCalidadCreateInput {
  codigo: string
  descripcion: string
  descripcionExtranjera?: string
  especieIds: number[]
}

export type NotaCalidadUpdateInput = Partial<Omit<NotaCalidadCreateInput, 'codigo'>> & { bloqueado?: boolean }
