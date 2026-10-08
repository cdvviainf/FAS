export type MantenedorModelo =
  | 'pais'
  | 'zona'
  | 'grupoMercado'
  | 'tipoEmbarque'
  | 'formaPago'
  | 'unidadMedida'
  | 'tipoPallet'
  | 'etiqueta'
  | 'altura'
  | 'tipoProduccion'
  | 'tipoParametro'
  // Catálogo de defectos (2026-10-06): 2 niveles GrupoDefecto -> Defecto
  | 'grupoDefecto'
  // Con FK
  | 'region'
  | 'defecto'
  | 'provincia'
  | 'comuna'
  | 'especie'
  | 'grupoVariedad'
  | 'variedad'
  | 'categoria'
  | 'calibre'
  | 'parametro'
  // Extraído de Parametro (2026-09-30): Cláusula de Venta / Incoterm, con
  // requiereFlete/requiereSeguro propios.
  | 'clausulaVenta'
  | 'tipoReclamo'
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
  mercadoId?: number
  tipoEmbarqueId?: number
  // Catálogo de defectos (2026-10-06)
  grupoDefectoId?: number
  // Puerto R9
  contexto?: 'origen' | 'destino'
  // Bodega
  comunaId?: number
  // Mostrar solo no bloqueados (para selects FK)
  soloActivos?: boolean
  // Orden server-side: JSON [{ id, desc }] (TanStack/getSortingStateParser)
  sort?: string
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
  esPaisNacional?: boolean   // solo Pais
  puedeSerOrigen?: boolean   // solo Pais
  // FK fields
  regionId?: number
  provinciaId?: number
  especieId?: number
  unidadMedidaCalidadId?: number | null  // Especie
  grupoVariedadId?: number
  tipoParametroId?: number
  grupoMercadoId?: number
  paisId?: number
  mercadoIds?: number[]  // Pais (N:M, 2026-10-05)
  tipoEmbarqueId?: number
  // Catálogo de defectos (2026-10-06)
  grupoDefectoId?: number  // Defecto
  especieIds?: number[]    // Defecto (N:M, validez por especie)
  orden?: number             // Categoria, Calibre
  control?: string[]         // Categoria, Calibre
  calibreEquivalenteId?: number | null  // Calibre (auto-referencial, misma especie)
  // ClausulaVenta
  requiereFlete?: boolean
  requiereSeguro?: boolean
  // TipoReclamo
  generaAnalisisCalidad?: boolean
  // Código de Aduana del SII (ClausulaVenta, TipoEmbarque, Puerto, Pais, Modalidad).
  codigoAduana?: string | null
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
  // Código de ItemMenu que protege este mantenedor (2026-10-07: un permiso por
  // mantenedor, en vez del genérico CONFIG_MANTENEDORES).
  itemCodigo: string     // e.g. 'CONFIG_PAISES'
  tienePaisOrigen?: boolean
  schemaKey?: string     // para selección de schema en controller
}
