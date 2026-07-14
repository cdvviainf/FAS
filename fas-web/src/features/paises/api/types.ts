export interface Pais {
  id: number;
  codigo: string; // ISO 3166-1 alfa-3
  descripcion: string;
  descripcionExtranjera?: string;
  esPaisOrigen: boolean;
  creadoEn: string;
}

export interface PaisesResponse {
  paises: Pais[];
  total: number;
}

export interface PaisFilters {
  page?: number;
  limit?: number;
  q?: string;
}

export interface PaisMutationPayload {
  codigo: string;
  descripcion: string;
  descripcionExtranjera?: string;
  esPaisOrigen: boolean;
}
