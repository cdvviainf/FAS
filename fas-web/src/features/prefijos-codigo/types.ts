// Mantiene la misma lista y orden que fas-api MODELOS_CON_CODIGO — si se
// agrega un modelo nuevo ahí, agregarlo también acá para que aparezca en el
// select del formulario.
export const MODELOS_CON_CODIGO_OPTIONS: { value: string; label: string }[] = [
  { value: 'pais', label: 'País' },
  { value: 'zona', label: 'Zona' },
  { value: 'grupoMercado', label: 'Grupo de Mercado' },
  { value: 'tipoEmbarque', label: 'Tipo de Embarque' },
  { value: 'formaPago', label: 'Forma de Pago' },
  { value: 'unidadMedida', label: 'Unidad de Medida' },
  { value: 'tipoPallet', label: 'Tipo de Pallet' },
  { value: 'altura', label: 'Altura' },
  { value: 'tipoProduccion', label: 'Tipo de Producción' },
  { value: 'tipoDefecto', label: 'Tipo de Defecto' },
  { value: 'tipoParametro', label: 'Tipo de Parámetro' },
  { value: 'region', label: 'Región' },
  { value: 'provincia', label: 'Provincia' },
  { value: 'comuna', label: 'Comuna' },
  { value: 'especie', label: 'Especie' },
  { value: 'grupoVariedad', label: 'Grupo de Variedad' },
  { value: 'variedad', label: 'Variedad' },
  { value: 'categoria', label: 'Categoría' },
  { value: 'calibre', label: 'Calibre' },
  { value: 'parametro', label: 'Parámetro' },
  { value: 'mercado', label: 'Mercado' },
  { value: 'puerto', label: 'Puerto' },
  { value: 'moneda', label: 'Moneda' },
  { value: 'temporada', label: 'Temporada' },
  { value: 'bodega', label: 'Bodega' },
  { value: 'conceptoCtaCte', label: 'Concepto Cta. Cte.' },
  { value: 'calificacion', label: 'Calificación' },
  { value: 'entidad', label: 'Entidad' },
  { value: 'articulo', label: 'Artículo' },
  { value: 'condicionPago', label: 'Condición de Pago' },
  { value: 'receta', label: 'Receta' },
  { value: 'tipoMovimiento', label: 'Tipo de Movimiento' },
  { value: 'conceptoLiquidacion', label: 'Concepto de Liquidación' },
  { value: 'perfil', label: 'Perfil' },
  { value: 'templateCarga', label: 'Template de Carga' },
]

// Los mantenedores genéricos se identifican en sus rutas/páginas por su
// `prefixRuta` (ej. "grupos-mercado"), pero el backend de Prefijos de Código
// identifica el mantenedor por el nombre del delegado Prisma (ej.
// "grupoMercado"). Este mapeo traduce uno al otro — debe reflejar
// exactamente `MANTENEDORES` en fas-api/config.routes.ts.
export const RECURSO_A_MODELO: Record<string, string> = {
  paises: 'pais',
  zonas: 'zona',
  'grupos-mercado': 'grupoMercado',
  'tipos-embarque': 'tipoEmbarque',
  'formas-pago': 'formaPago',
  'unidades-medida': 'unidadMedida',
  'tipos-pallet': 'tipoPallet',
  alturas: 'altura',
  'tipos-produccion': 'tipoProduccion',
  'tipos-defecto': 'tipoDefecto',
  'tipos-parametro': 'tipoParametro',
  regiones: 'region',
  especies: 'especie',
  provincias: 'provincia',
  comunas: 'comuna',
  'grupos-variedad': 'grupoVariedad',
  variedades: 'variedad',
  categorias: 'categoria',
  calibres: 'calibre',
  parametros: 'parametro',
  mercados: 'mercado',
  puertos: 'puerto',
  monedas: 'moneda',
  'conceptos-cta-cte': 'conceptoCtaCte',
  temporadas: 'temporada',
  bodegas: 'bodega',
  calificaciones: 'calificacion',
}

export interface PrefijoCodigo {
  id: number
  modelo: string
  prefijo: string
  digitos: number
}

export interface PrefijoCodigoCreateInput {
  modelo: string
  prefijo: string
  digitos: number
}

export type PrefijoCodigoUpdateInput = Partial<Omit<PrefijoCodigoCreateInput, 'modelo'>>
