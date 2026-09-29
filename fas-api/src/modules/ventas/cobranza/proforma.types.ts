export type DimensionProforma = 'VARIEDAD' | 'ARTICULO' | 'CALIBRE' | 'CATEGORIA' | 'MARCA'
export type EstadoProforma = 'EMITIDA' | 'ANULADA'

export interface ProformaLineaInput {
  descripcion: string
  especieId: number
  variedadId?: number | null
  articuloId?: number | null
  calibreId?: number | null
  categoriaId?: number | null
  etiquetaId?: number | null
  cantidadCajas: number
  precioUnitario: number
}

export interface ProformaEmitirInput {
  dimensiones: DimensionProforma[]
  idioma: string
  lineas: ProformaLineaInput[]
  // Flete/Seguro de la cláusula de venta — exigidos según los flags de la
  // cláusula (Parametro.requiereFlete/requiereSeguro). El service los valida.
  montoFlete?: number | null
  montoSeguro?: number | null
}

export interface ProformasListFilters {
  page?: number
  limit?: number
  embarqueId?: number
  clienteId?: number
  estado?: EstadoProforma
  // Busca sobre embarque.numeroInstructivo (mismo criterio que reclamos.md).
  folio?: string
}
