import { descripcionComercialArticulo } from '../../../shared/articulo-descripcion.js'

// Construcción de la descripción de línea (Proforma/Factura) según idioma y
// validación de descripciones extranjeras. La descripción se arma desde los
// mantenedores incluidos en la línea (Especie siempre + los que estén
// presentes), en el mismo orden que usa el motor de agrupación de la Proforma.

export type Idioma = 'ES' | 'EN'

export interface CampoDesc {
  descripcion: string
  descripcionExtranjera: string | null
  // Solo Artículo (2026-11-05): descripción comercial — la que se usa en ES
  // fuera de Materiales (fallback a `descripcion`, ver shared/articulo-descripcion.ts).
  descripcionComercial?: string | null
}

export interface LineaConMantenedores {
  especie: CampoDesc
  variedad?: CampoDesc | null
  articulo?: CampoDesc | null
  calibre?: CampoDesc | null
  categoria?: CampoDesc | null
  etiqueta?: CampoDesc | null
}

// Orden canónico de armado (igual a sugerirLineas de la Proforma).
const ORDEN: { key: keyof LineaConMantenedores; label: string }[] = [
  { key: 'especie', label: 'Especie' },
  { key: 'variedad', label: 'Variedad' },
  { key: 'articulo', label: 'Artículo' },
  { key: 'calibre', label: 'Calibre' },
  { key: 'categoria', label: 'Categoría' },
  { key: 'etiqueta', label: 'Etiqueta' },
]

function textoCampo(c: CampoDesc, idioma: Idioma): string {
  const base = descripcionComercialArticulo(c)
  if (idioma === 'EN') return (c.descripcionExtranjera && c.descripcionExtranjera.trim()) || base
  return base
}

// Descripción de la línea en el idioma pedido.
export function descripcionLinea(l: LineaConMantenedores, idioma: Idioma): string {
  return ORDEN.map(({ key }) => l[key])
    .filter((c): c is CampoDesc => !!c)
    .map((c) => textoCampo(c, idioma))
    .join(' - ')
}

// Mantenedores referenciados por las líneas que NO tienen descripcionExtranjera,
// como "Campo: descripción" únicos. Vacío = se puede emitir/mostrar en EN.
export function faltantesDescripcionExtranjera(lineas: LineaConMantenedores[]): string[] {
  const faltan = new Set<string>()
  for (const l of lineas) {
    for (const { key, label } of ORDEN) {
      const c = l[key] as CampoDesc | null | undefined
      if (c && !(c.descripcionExtranjera && c.descripcionExtranjera.trim())) {
        faltan.add(`${label}: ${descripcionComercialArticulo(c)}`)
      }
    }
  }
  return [...faltan]
}
