// Nombres de delegado Prisma (en camelCase, igual que `prisma.<modelo>`) de
// todos los mantenedores/módulos que tienen campo `codigo` administrable por
// el usuario y para los que tiene sentido sugerir un correlativo. Se agregan
// aquí a medida que se conecta cada formulario (ver plan de la sesión).
export const MODELOS_CON_CODIGO = [
  // Mantenedores genéricos (config.routes.ts MANTENEDORES)
  'pais', 'zona', 'grupoMercado', 'tipoEmbarque', 'formaPago', 'unidadMedida',
  'tipoPallet', 'etiqueta', 'altura', 'tipoProduccion', 'tipoDefecto', 'tipoParametro',
  'region', 'provincia', 'comuna', 'especie', 'grupoVariedad', 'variedad',
  'categoria', 'calibre', 'parametro', 'mercado', 'puerto', 'moneda',
  'temporada', 'bodega', 'conceptoCtaCte', 'calificacion',
  // Módulos dedicados
  'entidad', 'articulo', 'condicionPago', 'receta', 'tipoMovimiento',
  'conceptoLiquidacion', 'perfil', 'templateCarga',
] as const

export type ModeloConCodigo = (typeof MODELOS_CON_CODIGO)[number]

// 'embarque' es un caso especial (2026-08-13, ventas.md R10): no tiene campo
// `codigo` administrable como el resto (usa `numeroInstructivo`, derivado del
// folio de la NV, no autoincremental) — por eso NO se agrega a
// MODELOS_CON_CODIGO (eso rompería `calcularSiguienteCodigo`, que asume una
// columna `codigo`). Solo se admite como valor de `modelo` en el CRUD de
// prefijos, con `tipoEmbarqueId` obligatorio (un prefijo por Tipo de
// Embarque, no uno global).
export const MODELOS_CON_PREFIJO = [...MODELOS_CON_CODIGO, 'embarque'] as const

export interface PrefijoCodigoCreateInput {
  modelo: string
  tipoEmbarqueId?: number | null
  prefijo: string
  digitos: number
}

export type PrefijoCodigoUpdateInput = Partial<Omit<PrefijoCodigoCreateInput, 'modelo' | 'tipoEmbarqueId'>>
