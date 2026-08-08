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

export interface PrefijoCodigoCreateInput {
  modelo: string
  prefijo: string
  digitos: number
}

export type PrefijoCodigoUpdateInput = Partial<Omit<PrefijoCodigoCreateInput, 'modelo'>>
