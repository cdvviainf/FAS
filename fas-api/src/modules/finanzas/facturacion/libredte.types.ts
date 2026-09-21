// Tipos del payload de LibreDTE (www.libredte.cl/docs/api). El objeto JSON
// espeja 1:1 los tags del XML de DTE del SII (mismos nombres, mismos tipos),
// así que se modelan solo los campos mínimos usados por FAS y se deja el
// resto abierto — el detalle completo de campos vive en la documentación del
// SII (referenciada en la propia doc de LibreDTE), no tiene sentido
// replicarlo acá hasta tener el spec real de Facturación (CLAUDE.md: pendiente).

export interface LibredteDetalleItem {
  NmbItem: string
  QtyItem: number
  // Opcional: una Guía de Despacho de traslado interno (sin venta) no lleva
  // precio unitario — solo los documentos con venta (factura, boleta, guía
  // con venta) lo requieren.
  PrcItem?: number
  IndExe?: number
  [campo: string]: unknown
}

export interface LibredteEncabezado {
  IdDoc: { TipoDTE: number; [campo: string]: unknown }
  Emisor: { RUTEmisor: string; [campo: string]: unknown }
  Receptor: {
    RUTRecep: string
    RznSocRecep: string
    GiroRecep?: string
    DirRecep?: string
    CmnaRecep?: string
    [campo: string]: unknown
  }
  [campo: string]: unknown
}

export interface LibredteDtePayload {
  Encabezado: LibredteEncabezado
  Detalle: LibredteDetalleItem[]
  // Datos extra de LibreDTE (no forman parte del XML SII) — tags para PDF,
  // gráficos de consumo, etc. Ver Docs de la API, sección "Agregar datos
  // Extras al DTE".
  LibreDTE?: { extra?: Record<string, unknown> }
}

export interface LibredteEmitirOpts {
  normalizar?: '0' | '1'
  formato?: 'json' | 'xml' | 'yaml' | 'JSONString' | string
  links?: '0' | '1'
  email?: '0' | '1'
}

export interface LibredteGenerarInput {
  codigo: string
  dte: number
  // RUT sin DV, numérico (ej. 76192083 para "76192083-9").
  emisor: number
  receptor: number
}

export interface LibredteGenerarOpts {
  getXML?: '0' | '1'
  links?: '0' | '1'
  email?: '0' | '1'
  retry?: string
  gzip?: '0' | '1'
}

export interface LibredteResultado<T = unknown> {
  ok: boolean
  status?: number
  data?: T
  error?: string
}
