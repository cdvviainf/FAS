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
  { value: 'etiqueta', label: 'Etiqueta' },
  { value: 'altura', label: 'Altura' },
  { value: 'tipoProduccion', label: 'Tipo de Producción' },
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
  { value: 'entidad', label: 'Entidad' },
  { value: 'entidadDireccion', label: 'Dirección de Entidad' },
  { value: 'entidadContacto', label: 'Contacto de Entidad' },
  { value: 'articulo', label: 'Artículo' },
  { value: 'condicionPago', label: 'Condición de Pago' },
  { value: 'receta', label: 'Receta' },
  { value: 'tipoMovimiento', label: 'Tipo de Movimiento' },
  { value: 'conceptoLiquidacion', label: 'Concepto de Liquidación' },
  { value: 'perfil', label: 'Perfil' },
  { value: 'templateCarga', label: 'Template de Carga' },
  { value: 'proforma', label: 'Proforma' },
  { value: 'facturaExportacion', label: 'Factura de Exportación' },
]

// 'embarque' es un caso especial (2026-08-13, ventas.md R10): no tiene campo
// `codigo` propio (usa `numeroInstructivo`, derivado del folio de la NV) y
// el prefijo es por Tipo de Embarque, no global — por eso vive en una
// constante separada de MODELOS_CON_CODIGO_OPTIONS en vez de agregarse ahí.
export const MODELO_EMBARQUE_OPTION = { value: 'embarque', label: 'Embarque (número de instructivo)' }

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
  etiquetas: 'etiqueta',
  alturas: 'altura',
  'tipos-produccion': 'tipoProduccion',
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
}

// Permiso (ItemMenu) por mantenedor (2026-10-07): un permiso propio por cada
// catálogo, en vez del genérico CONFIG_MANTENEDORES. Debe reflejar `itemCodigo`
// de MANTENEDORES en fas-api/config.routes.ts. Usado por los componentes
// genéricos de mantenedor-simple para ocultar acciones de escritura según nivel.
export const RECURSO_A_ITEM_MENU: Record<string, string> = {
  paises: 'CONFIG_PAISES',
  zonas: 'CONFIG_ZONAS',
  'grupos-mercado': 'CONFIG_GRUPOS_MERCADO',
  'tipos-embarque': 'CONFIG_TIPOS_EMBARQUE',
  'formas-pago': 'CONFIG_FORMAS_PAGO',
  'unidades-medida': 'CONFIG_UNIDADES_MEDIDA',
  'tipos-pallet': 'CONFIG_TIPOS_PALLET',
  etiquetas: 'CONFIG_ETIQUETAS',
  alturas: 'CONFIG_ALTURAS',
  'tipos-produccion': 'CONFIG_TIPOS_PRODUCCION',
  'tipos-parametro': 'CONFIG_TIPOS_PARAMETRO',
  'grupos-defecto': 'CONFIG_GRUPOS_DEFECTO',
  regiones: 'CONFIG_REGIONES',
  especies: 'CONFIG_ESPECIES',
  provincias: 'CONFIG_PROVINCIAS',
  comunas: 'CONFIG_COMUNAS',
  'grupos-variedad': 'CONFIG_GRUPOS_VARIEDAD',
  variedades: 'CONFIG_VARIEDADES',
  defectos: 'CONFIG_DEFECTOS',
  categorias: 'CONFIG_CATEGORIAS',
  calibres: 'CONFIG_CALIBRES',
  parametros: 'CONFIG_PARAMETROS',
  'clausulas-venta': 'CONFIG_CLAUSULAS_VENTA',
  'tipos-reclamo': 'CONFIG_TIPOS_RECLAMO',
  mercados: 'CONFIG_MERCADOS',
  puertos: 'CONFIG_PUERTOS',
  monedas: 'CONFIG_MONEDAS',
  'conceptos-cta-cte': 'CONFIG_CONCEPTOS_CTA_CTE',
  temporadas: 'CONFIG_TEMPORADAS',
  bodegas: 'CONFIG_BODEGAS',
  'condiciones-pago': 'CONFIG_CONDICIONES_PAGO',
  'notas-calidad': 'CONFIG_NOTAS_CALIDAD',
  'notas-condicion': 'CONFIG_NOTAS_CONDICION',
  'templates-carga': 'CONFIG_TEMPLATES_CARGA',
  'prefijos-codigo': 'CONFIG_PREFIJOS_CODIGO',
}

// Código de ItemMenu de un recurso de mantenedor. Fallback '' → nivel
// SIN_ACCESO (oculta la acción) si el recurso no está mapeado.
export function itemMenuDeRecurso(recurso: string): string {
  return RECURSO_A_ITEM_MENU[recurso] ?? ''
}

export interface PrefijoCodigo {
  id: number
  modelo: string
  tipoEmbarqueId: number | null
  tipoEmbarque: { id: number; codigo: string; descripcion: string } | null
  prefijo: string
  digitos: number
}

export interface PrefijoCodigoCreateInput {
  modelo: string
  tipoEmbarqueId?: number | null
  prefijo: string
  digitos: number
}

export type PrefijoCodigoUpdateInput = Partial<Omit<PrefijoCodigoCreateInput, 'modelo' | 'tipoEmbarqueId'>>
