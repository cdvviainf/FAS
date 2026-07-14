export interface Region {
  id: number;
  codigo: string;
  descripcion: string;
  descripcionExtranjera?: string;
  creadoEn: string;
}

export interface RegionesResponse {
  regiones: Region[];
  total: number;
}

export interface RegionFilters {
  page?: number;
  limit?: number;
  q?: string;
  sort?: string;
}

export interface RegionMutationPayload {
  codigo: string;
  descripcion: string;
  descripcionExtranjera?: string;
}
