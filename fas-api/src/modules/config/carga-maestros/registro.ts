import type { HojaSpec } from '../../../lib/carga-maestros/tipos.js'

// ─── Registro de maestros para Carga Masiva (FAS) ────────────────────────────
//
// Única fuente de verdad de la Carga Masiva: describe cada hoja, sus columnas,
// tipos, obligatoriedad, FKs y qué códigos se autogeneran. Alimenta el
// generador del template y el cargador. Los encabezados replican EXACTAMENTE el
// archivo `Carga_Masiva_Maestros_FAS.xlsx` que ya usa el cliente, para que su
// libro ya llenado se cargue sin retrabajo.
//
// Convención de autogeneración (decisión 2026-09-14): las columnas "Código"
// propias del registro son OPCIONALES; si vienen vacías, el cargador genera el
// código vía PrefijoCodigo. Excepción: `Paises.codigo` es ISO alfa-3 (estándar
// externo, lo provee el cliente) y `Predios.codigo` es único por productor.

// Listas cerradas (enums de Prisma) — también alimentan los dropdowns.
export const ENUM_TIPO_ARTICULO = ['EMBALAJE', 'ENVASE', 'MATERIAL_EMBALAJE', 'SERVICIO']
export const ENUM_TIPO_COSTEO = ['PROMEDIO_PONDERADO', 'ESTANDAR']
export const ENUM_TIPO_ENTIDAD = [
  'CLIENTE_NACIONAL',
  'CLIENTE_EXTRANJERO',
  'NOTIFY',
  'CONSIGNATARIO',
  'NAVIERA',
  'AGENTE_ADUANA',
  'COMPANIA_EMBARQUE',
  'PROVEEDOR',
  'EMPRESA_TRANSPORTE',
  'PRODUCTOR',
  'EXPORTADORA',
  'PLANTA',
  'GESTOR_LOGISTICO',
]
export const ENUM_TIPO_BODEGA = ['MATERIALES', 'EMBARQUE', 'DESPACHO']
export const ENUM_MODELO_PREFIJO = [
  'pais', 'zona', 'grupoMercado', 'tipoEmbarque', 'formaPago', 'unidadMedida',
  'tipoPallet', 'etiqueta', 'altura', 'tipoProduccion', 'tipoDefecto',
  'tipoParametro', 'especie', 'grupoVariedad', 'variedad', 'categoria',
  'calibre', 'parametro', 'mercado', 'puerto', 'moneda', 'temporada', 'bodega',
  'entidad', 'articulo', 'receta', 'embarque',
]

// Columnas comunes reutilizadas.
const COL_DESCRIPCION = { encabezado: 'Descripción', campo: 'descripcion', tipo: 'texto' as const, requerido: true }
const COL_DESCRIPCION_EXT = { encabezado: 'Descripción Extranjera', campo: 'descripcionExtranjera', tipo: 'texto' as const }

export const REGISTRO_MAESTROS: HojaSpec[] = [
  // ─── Geografía global (sin empresa) ────────────────────────────────────────
  {
    hoja: 'Paises',
    modelo: 'pais',
    titulo: 'Países',
    descripcion: 'Maestro global (no pertenece a una empresa).',
    dependeDe: [],
    columnas: [
      { encabezado: 'Código (ISO alfa-3)', campo: 'codigo', tipo: 'texto', requerido: true, ayuda: 'Código ISO 3166-1 alfa-3 (ej. CHL, USA, CHN). NO se autogenera.' },
      COL_DESCRIPCION,
      COL_DESCRIPCION_EXT,
      { encabezado: 'Es País Nacional (SI/NO)', campo: 'esPaisNacional', tipo: 'booleanSiNo', ayuda: 'Marca el país base (Chile). Debe haber exactamente uno.' },
      { encabezado: 'Puede Ser Origen (SI/NO)', campo: 'puedeSerOrigen', tipo: 'booleanSiNo' },
    ],
  },

  // ─── Maestros de fruta (por empresa) ───────────────────────────────────────
  {
    hoja: 'Especies',
    modelo: 'especie',
    titulo: 'Especies',
    descripcion: 'Especies de fruta. El código se usa como referencia en Grupos de Variedad, Variedades, Categorías y Calibres.',
    dependeDe: [],
    columnas: [
      { encabezado: 'Código', campo: 'codigo', tipo: 'texto', autogenerar: true, ayuda: 'Recomendado llenarlo: otras hojas referencian este código.' },
      COL_DESCRIPCION,
      COL_DESCRIPCION_EXT,
      { encabezado: 'Unidad de Medida Calidad (código, ya existente, opcional)', campo: 'unidadMedidaCalidadId', tipo: 'fk', fk: { externo: true, modelo: 'unidadMedida' }, ayuda: 'Unidad de Medida ya existente en el sistema. Opcional.' },
    ],
  },
  {
    hoja: 'Etiquetas',
    modelo: 'etiqueta',
    titulo: 'Etiquetas',
    descripcion: 'Etiquetas de embalaje. Referenciadas por Artículos de tipo EMBALAJE.',
    dependeDe: [],
    columnas: [
      { encabezado: 'Código', campo: 'codigo', tipo: 'texto', autogenerar: true, ayuda: 'Recomendado llenarlo: los Artículos referencian este código.' },
      COL_DESCRIPCION,
      COL_DESCRIPCION_EXT,
    ],
  },
  {
    hoja: 'GruposVariedad',
    modelo: 'grupoVariedad',
    titulo: 'Grupos de Variedad',
    descripcion: 'Agrupaciones de variedades por especie. OJO: el código debe ser único por empresa (no por especie).',
    dependeDe: ['Especies'],
    columnas: [
      { encabezado: 'Código', campo: 'codigo', tipo: 'texto', autogenerar: true, ayuda: 'Único por empresa. Ej. UVA-VERDE, UVA-ROJA (no repetir "TODAS").' },
      COL_DESCRIPCION,
      COL_DESCRIPCION_EXT,
      { encabezado: 'Especie (código)', campo: 'especieId', tipo: 'fk', requerido: true, fk: { hoja: 'Especies' } },
    ],
  },
  {
    hoja: 'Variedades',
    modelo: 'variedad',
    titulo: 'Variedades',
    descripcion: 'Variedades de cada especie.',
    dependeDe: ['Especies', 'GruposVariedad'],
    columnas: [
      { encabezado: 'Código', campo: 'codigo', tipo: 'texto', autogenerar: true },
      COL_DESCRIPCION,
      COL_DESCRIPCION_EXT,
      { encabezado: 'Especie (código)', campo: 'especieId', tipo: 'fk', requerido: true, fk: { hoja: 'Especies' } },
      { encabezado: 'Grupo de Variedad (código)', campo: 'grupoVariedadId', tipo: 'fk', requerido: true, fk: { hoja: 'GruposVariedad' } },
    ],
  },
  {
    hoja: 'Categorias',
    modelo: 'categoria',
    titulo: 'Categorías',
    descripcion: 'Categorías comerciales por especie. El "Orden" debe ser único por especie.',
    dependeDe: ['Especies'],
    columnas: [
      { encabezado: 'Código', campo: 'codigo', tipo: 'texto', autogenerar: true },
      COL_DESCRIPCION,
      COL_DESCRIPCION_EXT,
      { encabezado: 'Especie (código)', campo: 'especieId', tipo: 'fk', requerido: true, fk: { hoja: 'Especies' } },
      { encabezado: 'Orden', campo: 'orden', tipo: 'entero', requerido: true },
      { encabezado: 'Control (lista separada por coma)', campo: 'control', tipo: 'listaControl' },
    ],
  },
  {
    hoja: 'Calibres',
    modelo: 'calibre',
    titulo: 'Calibres',
    descripcion: 'Calibres por especie. El "Orden" debe ser único por especie. El calibre equivalente (opcional) debe ser de la misma especie; si se deja vacío, el calibre queda como su propio equivalente.',
    dependeDe: ['Especies'],
    columnas: [
      { encabezado: 'Código', campo: 'codigo', tipo: 'texto', autogenerar: true },
      COL_DESCRIPCION,
      COL_DESCRIPCION_EXT,
      { encabezado: 'Especie (código)', campo: 'especieId', tipo: 'fk', requerido: true, fk: { hoja: 'Especies' } },
      { encabezado: 'Orden', campo: 'orden', tipo: 'entero', requerido: true },
      { encabezado: 'Control (lista separada por coma)', campo: 'control', tipo: 'listaControl' },
      { encabezado: 'Calibre Equivalente (código, misma especie, opcional)', campo: 'calibreEquivalenteId', tipo: 'fk', fk: { hoja: 'Calibres', modelo: 'calibre' }, ayuda: 'Otro calibre de la misma especie. Vacío = el mismo calibre. Debe referenciar un calibre de una fila anterior.' },
    ],
  },
  {
    hoja: 'Mercados',
    modelo: 'mercado',
    titulo: 'Mercados',
    descripcion: 'Mercados comerciales. El Grupo de Mercado YA DEBE EXISTIR en el sistema.',
    dependeDe: [],
    columnas: [
      { encabezado: 'Código', campo: 'codigo', tipo: 'texto', autogenerar: true },
      COL_DESCRIPCION,
      COL_DESCRIPCION_EXT,
      { encabezado: 'Grupo de Mercado (código, ya existente)', campo: 'grupoMercadoId', tipo: 'fk', requerido: true, fk: { externo: true, modelo: 'grupoMercado' } },
    ],
  },
  {
    hoja: 'Puertos',
    modelo: 'puerto',
    titulo: 'Puertos',
    descripcion: 'Puertos de embarque/destino. El Tipo de Embarque YA DEBE EXISTIR.',
    dependeDe: ['Paises'],
    columnas: [
      { encabezado: 'Código', campo: 'codigo', tipo: 'texto', autogenerar: true },
      COL_DESCRIPCION,
      COL_DESCRIPCION_EXT,
      { encabezado: 'País (código)', campo: 'paisId', tipo: 'fk', requerido: true, fk: { hoja: 'Paises' } },
      { encabezado: 'Tipo de Embarque (código, ya existente)', campo: 'tipoEmbarqueId', tipo: 'fk', requerido: true, fk: { externo: true, modelo: 'tipoEmbarque' } },
      { encabezado: 'Latitud', campo: 'latitud', tipo: 'decimal' },
      { encabezado: 'Longitud', campo: 'longitud', tipo: 'decimal' },
    ],
  },

  // ─── País ↔ Mercado (mapeo por empresa) ─────────────────────────────────────
  {
    hoja: 'PaisMercado',
    modelo: 'mercadoPais',
    titulo: 'Países por Mercado',
    descripcion: 'Asigna cada país a un mercado (mapeo por empresa). El País y el Mercado YA DEBEN EXISTIR; se puede recargar para reasignar (upsert, no duplica).',
    dependeDe: ['Paises', 'Mercados'],
    columnas: [
      { encabezado: 'País (código)', campo: 'paisId', tipo: 'fk', requerido: true, fk: { hoja: 'Paises', externo: true, modelo: 'pais' } },
      { encabezado: 'Mercado (código)', campo: 'mercadoId', tipo: 'fk', requerido: true, fk: { hoja: 'Mercados', externo: true, modelo: 'mercado' } },
    ],
  },

  // ─── Entidades y predios ───────────────────────────────────────────────────
  {
    hoja: 'Entidades',
    modelo: 'entidad',
    titulo: 'Entidades',
    descripcion: 'Clientes, productores, proveedores, navieras, etc. Direcciones y contactos se cargan aparte.',
    dependeDe: ['Paises'],
    columnas: [
      { encabezado: 'Código', campo: 'codigo', tipo: 'texto', autogenerar: true },
      COL_DESCRIPCION,
      COL_DESCRIPCION_EXT,
      { encabezado: 'Razón Social', campo: 'razonSocial', tipo: 'texto', requerido: true },
      { encabezado: 'Giro', campo: 'giro', tipo: 'texto' },
      { encabezado: 'Identificador (RUT)', campo: 'identificador', tipo: 'texto' },
      { encabezado: 'País (código)', campo: 'paisId', tipo: 'fk', requerido: true, fk: { hoja: 'Paises' } },
      { encabezado: 'Email', campo: 'email', tipo: 'texto' },
      { encabezado: 'Teléfono', campo: 'telefono', tipo: 'texto' },
      { encabezado: 'Código Externo', campo: 'codigoExterno', tipo: 'texto' },
      { encabezado: 'Tipos (separados por coma)', campo: 'tipos', tipo: 'enumMulti', requerido: true, enumValores: ENUM_TIPO_ENTIDAD },
    ],
  },
  {
    hoja: 'Predios',
    modelo: 'predio',
    titulo: 'Predios',
    descripcion: 'Predios de cada productor. El código es único por productor.',
    dependeDe: ['Entidades'],
    codigoUnicoGlobal: false, // Predio.codigo es único por productor, no por hoja
    columnas: [
      { encabezado: 'Entidad Productor (código)', campo: 'entidadId', tipo: 'fk', requerido: true, fk: { hoja: 'Entidades' } },
      { encabezado: 'Código', campo: 'codigo', tipo: 'texto', requerido: true, ayuda: 'Único por productor. NO se autogenera.' },
      COL_DESCRIPCION,
      { encabezado: 'Código CSG', campo: 'codigoCsg', tipo: 'texto' },
      { encabezado: 'Nombre CSG', campo: 'nombreCsg', tipo: 'texto' },
      { encabezado: 'Código SDP', campo: 'codigoSdp', tipo: 'texto' },
      { encabezado: 'Código GGN', campo: 'codigoGgn', tipo: 'texto' },
      { encabezado: 'Dirección*', campo: 'direccion', tipo: 'textoLargo' },
      { encabezado: 'Comuna (código, opcional)', campo: 'comunaId', tipo: 'fk', fk: { externo: true, modelo: 'comuna' } },
      { encabezado: 'Tipo de Producción (código, ya existente, opcional)', campo: 'tipoProduccionId', tipo: 'fk', fk: { externo: true, modelo: 'tipoProduccion' } },
      { encabezado: 'Zona (código, ya existente, opcional)', campo: 'zonaId', tipo: 'fk', fk: { externo: true, modelo: 'zona' } },
      { encabezado: 'Latitud', campo: 'latitud', tipo: 'decimal' },
      { encabezado: 'Longitud', campo: 'longitud', tipo: 'decimal' },
    ],
  },

  // ─── Prefijos de código ────────────────────────────────────────────────────
  {
    hoja: 'PrefijosCodigo',
    modelo: 'prefijoCodigo',
    titulo: 'Prefijos de Código',
    descripcion: 'Configura el prefijo + dígitos del correlativo de cada maestro (necesario para autogenerar códigos).',
    dependeDe: [],
    columnas: [
      { encabezado: 'Modelo', campo: 'modelo', tipo: 'enum', requerido: true, enumValores: ENUM_MODELO_PREFIJO },
      { encabezado: 'Tipo de Embarque (código, solo si Modelo = embarque)', campo: 'tipoEmbarqueId', tipo: 'fk', fk: { externo: true, modelo: 'tipoEmbarque' } },
      { encabezado: 'Prefijo', campo: 'prefijo', tipo: 'texto', requerido: true },
      { encabezado: 'Dígitos', campo: 'digitos', tipo: 'entero', requerido: true },
    ],
  },

  // ─── Materiales ────────────────────────────────────────────────────────────
  {
    hoja: 'Articulos',
    modelo: 'articulo',
    titulo: 'Artículos',
    descripcion: 'Artículos de materiales (embalaje, envases, servicios). La Unidad de Medida YA DEBE EXISTIR.',
    dependeDe: ['Etiquetas'],
    columnas: [
      { encabezado: 'Tipo', campo: 'tipo', tipo: 'enum', requerido: true, enumValores: ENUM_TIPO_ARTICULO },
      { encabezado: 'Código', campo: 'codigo', tipo: 'texto', autogenerar: true },
      COL_DESCRIPCION,
      COL_DESCRIPCION_EXT,
      { encabezado: 'Unidad (código, ya existente)', campo: 'unidadId', tipo: 'fk', requerido: true, fk: { externo: true, modelo: 'unidadMedida' } },
      { encabezado: 'Tipo de Costeo', campo: 'tipoCosteo', tipo: 'enum', requerido: true, enumValores: ENUM_TIPO_COSTEO },
      { encabezado: 'Valor Estándar (requerido si Tipo de Costeo = ESTANDAR)', campo: 'valorEstandar', tipo: 'decimal', ayuda: 'Obligatorio si Tipo de Costeo = ESTANDAR.' },
      { encabezado: 'Controla Stock (SI/NO)', campo: 'controlaStock', tipo: 'booleanSiNo', ayuda: 'Se deriva del Tipo de Costeo; opcional.' },
      { encabezado: 'Stock Crítico', campo: 'stockCritico', tipo: 'decimal' },
      { encabezado: 'Etiqueta (código, requerido si Tipo = EMBALAJE)', campo: 'etiquetaId', tipo: 'fk', fk: { hoja: 'Etiquetas' }, ayuda: 'Obligatorio si Tipo = EMBALAJE.' },
      { encabezado: 'Kg Neto Envase', campo: 'kgNetoEnvase', tipo: 'decimal' },
      { encabezado: 'Kg Bruto Envase', campo: 'kgBrutoEnvase', tipo: 'decimal' },
      { encabezado: 'Especie', tipo: 'texto', ayuda: 'Columna informativa: el modelo Artículo no tiene especie, este valor se ignora al cargar.' },
    ],
  },
  {
    hoja: 'Bodegas',
    modelo: 'bodega',
    titulo: 'Bodegas',
    descripcion: 'Bodegas físicas. La Comuna YA DEBE EXISTIR.',
    dependeDe: [],
    columnas: [
      { encabezado: 'Código', campo: 'codigo', tipo: 'texto', autogenerar: true },
      COL_DESCRIPCION,
      COL_DESCRIPCION_EXT,
      { encabezado: 'Dirección', campo: 'direccion', tipo: 'textoLargo', requerido: true },
      { encabezado: 'Comuna (código)', campo: 'comunaId', tipo: 'fk', requerido: true, fk: { externo: true, modelo: 'comuna' } },
      { encabezado: 'Tipos (MATERIALES/EMBARQUE/DESPACHO, separados por coma)', campo: 'tipos', tipo: 'enumMulti', requerido: true, enumValores: ENUM_TIPO_BODEGA },
      { encabezado: 'Latitud', campo: 'latitud', tipo: 'decimal' },
      { encabezado: 'Longitud', campo: 'longitud', tipo: 'decimal' },
    ],
  },
  {
    hoja: 'Recetas',
    modelo: 'receta',
    titulo: 'Recetas',
    descripcion: 'Recetas de producción, asociadas a un Artículo de tipo EMBALAJE.',
    dependeDe: ['Articulos'],
    columnas: [
      { encabezado: 'Embalaje (código de Artículo tipo EMBALAJE)', campo: 'embalajeId', tipo: 'fk', requerido: true, fk: { hoja: 'Articulos' } },
      { encabezado: 'Código', campo: 'codigo', tipo: 'texto', autogenerar: true },
      COL_DESCRIPCION,
      { encabezado: 'Cantidad a Producir', campo: 'cantidadAProducir', tipo: 'decimal', requerido: true },
    ],
  },
  {
    hoja: 'CajasPorPallet',
    modelo: 'cajasPorPallet',
    titulo: 'Cajas por Pallet',
    descripcion: 'Cajas teóricas por embalaje + tipo de pallet (upsert). El Embalaje y el Tipo de Pallet YA DEBEN EXISTIR.',
    dependeDe: ['Articulos'],
    columnas: [
      { encabezado: 'Embalaje (código de Artículo tipo EMBALAJE)', campo: 'articuloId', tipo: 'fk', requerido: true, fk: { hoja: 'Articulos', externo: true, modelo: 'articulo' } },
      { encabezado: 'Tipo de Pallet (código, ya existente)', campo: 'tipoPalletId', tipo: 'fk', requerido: true, fk: { externo: true, modelo: 'tipoPallet' } },
      { encabezado: 'Cajas por Pallet', campo: 'cajasPorPallet', tipo: 'entero', requerido: true },
    ],
  },
  {
    hoja: 'RecetasDetalle',
    modelo: 'recetaDetalle',
    titulo: 'Detalle de Recetas',
    descripcion: 'Componentes que consume cada receta.',
    dependeDe: ['Recetas', 'Articulos'],
    columnas: [
      { encabezado: 'Receta (código)', campo: 'recetaId', tipo: 'fk', requerido: true, fk: { hoja: 'Recetas' } },
      { encabezado: 'Componente (código de Artículo)', campo: 'componenteId', tipo: 'fk', requerido: true, fk: { hoja: 'Articulos' } },
      { encabezado: 'Cantidad a Consumir', campo: 'cantidadAConsumir', tipo: 'decimal', requerido: true },
    ],
  },
]

/** Orden topológico de carga (respeta `dependeDe`). */
export function ordenTopologico(hojas: HojaSpec[] = REGISTRO_MAESTROS): HojaSpec[] {
  const porNombre = new Map(hojas.map((h) => [h.hoja, h]))
  const visitado = new Set<string>()
  const orden: HojaSpec[] = []
  const visitar = (h: HojaSpec, cadena: string[]) => {
    if (visitado.has(h.hoja)) return
    if (cadena.includes(h.hoja)) throw new Error(`Dependencia circular: ${[...cadena, h.hoja].join(' -> ')}`)
    for (const dep of h.dependeDe) {
      const d = porNombre.get(dep)
      if (d) visitar(d, [...cadena, h.hoja])
    }
    visitado.add(h.hoja)
    orden.push(h)
  }
  for (const h of hojas) visitar(h, [])
  return orden
}
