export type MantenedorModelo =
  | 'pais'
  | 'zona'
  | 'grupoMercado'
  | 'tipoEmbarque'
  | 'unidadMedida'
  | 'tipoPallet'
  | 'altura'
  | 'tipoProduccion'
  | 'tipoDefecto'
  | 'tipoParametro'
  // Con FK
  | 'region'
  | 'provincia'
  | 'comuna'
  | 'especie'
  | 'grupoVariedad'
  | 'variedad'
  | 'categoria'
  | 'calibre'
  | 'parametro'
  | 'mercado'
  // Lote 3
  | 'puerto'
  | 'moneda'
  | 'conceptoCtaCte'
  // Lote 4
  | 'temporada'
  | 'bodega'

export interface MantenedorListFilters {
  q?: string
  page?: number
  limit?: number
  // FK filters
  regionId?: number
  provinciaId?: number
  especieId?: number
  grupoVariedadId?: number
  tipoParametroId?: number
  grupoMercadoId?: number
  paisId?: number
  tipoEmbarqueId?: number
  // Puerto R9
  contexto?: 'origen' | 'destino'
  // Bodega
  comunaId?: number
  // Mostrar solo no bloqueados (para selects FK)
  soloActivos?: boolean
}

export interface BodegaContactoInput {
  id?: number
  nombre: string
  email?: string
  telefono?: string
  orden?: number
}

export interface MantenedorCreateInput {
  codigo: string
  descripcion: string
  descripcionExtranjera?: string
  esPaisOrigen?: boolean     // solo Pais
  // FK fields
  regionId?: number
  provinciaId?: number
  especieId?: number
  unidadMedidaCalidadId?: number | null  // Especie
  grupoVariedadId?: number
  tipoParametroId?: number
  grupoMercadoId?: number
  paisId?: number
  tipoEmbarqueId?: number
  orden?: number             // Categoria, Calibre
  control?: string[]         // Categoria, Calibre
  // Moneda
  esMonedaBase?: boolean
  decimales?: number
  // Puerto
  latitud?: number
  longitud?: number
  // ConceptoCtaCte
  naturaleza?: string
  // Temporada
  fechaInicio?: string
  fechaTermino?: string
  predeterminada?: boolean   // Temporada
  // Bodega
  direccion?: string
  comunaId?: number
  tipos?: string[]
  contactos?: BodegaContactoInput[]
  // Estado
  bloqueado?: boolean
}

export interface MantenedorConfig {
  modelo: MantenedorModelo
  prefixRuta: string     // e.g. 'paises'
  label: string          // e.g. 'País'
  tienePaisOrigen?: boolean
  schemaKey?: string     // para selección de schema en controller
}
