export interface RecetaDetalle {
  id: number;
  componenteId: number;
  componenteCodigo: string;
  componenteDescripcion: string;
  componenteUnidad: string;
  cantidadAConsumir: number;
}

export interface Receta {
  id: number;
  codigo: string;
  descripcion: string;
  embalajeId: number;
  embalajeCodigo: string;
  embalajeDescripcion: string;
  cantidadAProducir: number;
  activo: boolean;
  detalle: RecetaDetalle[];
  cantidadComponentes: number;
  creadoEn: string;
}

export interface RecetasResponse {
  recetas: Receta[];
  total: number;
}

export interface RecetaFilters {
  page?: number;
  limit?: number;
  q?: string;
  sort?: string;
}

export interface RecetaDetallePayload {
  componenteId: number;
  cantidadAConsumir: number;
}

export interface RecetaMutationPayload {
  codigo: string;
  descripcion: string;
  embalajeId: number;
  cantidadAProducir: number;
  activo: boolean;
  detalle: RecetaDetallePayload[];
}
