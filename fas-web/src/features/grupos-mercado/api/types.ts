export interface GrupoMercado {
  id: number;
  codigo: string;
  descripcion: string;
  descripcionExtranjera?: string;
  creadoEn: string;
}

export interface GruposMercadoResponse {
  grupos: GrupoMercado[];
  total: number;
}

export interface GrupoMercadoFilters {
  page?: number;
  limit?: number;
  q?: string;
}

export interface GrupoMercadoMutationPayload {
  codigo: string;
  descripcion: string;
  descripcionExtranjera?: string;
}
