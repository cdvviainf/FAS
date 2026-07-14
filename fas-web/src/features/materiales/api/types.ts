export type TipoArticulo = 'EMBALAJE' | 'ENVASE' | 'MATERIAL_EMBALAJE' | 'SERVICIO';
export type TipoCosteo = 'PROMEDIO_PONDERADO' | 'ESTANDAR';

export interface Articulo {
  id: number;
  tipo: TipoArticulo;
  codigo: string;
  descripcion: string;
  descripcionExtranjera?: string;
  unidad: string;
  tipoCosteo: TipoCosteo;
  valorEstandar?: number;
  controlaStock: boolean;
  stockCritico?: number;
  activo: boolean;
  creadoEn: string;
}

export interface ArticulosResponse {
  articulos: Articulo[];
  total: number;
}

export interface ArticuloFilters {
  page?: number;
  limit?: number;
  q?: string;
  tipo?: string;
  sort?: string;
}

export interface ArticuloMutationPayload {
  tipo: TipoArticulo;
  codigo: string;
  descripcion: string;
  descripcionExtranjera?: string;
  unidad: string;
  tipoCosteo: TipoCosteo;
  valorEstandar?: number;
  stockCritico?: number;
  activo: boolean;
}
