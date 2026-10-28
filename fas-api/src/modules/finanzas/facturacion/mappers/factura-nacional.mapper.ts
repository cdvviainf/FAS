import type { LibredteDtePayload } from '../libredte.types.js'

// Emisor ya resuelto (empresa) — rut garantizado por el service.
export interface EmisorFacturaNacional {
  rut: string
  razonSocial: string
  giro: string | null
  direccion: string | null
  comuna: string | null
}

// Receptor nacional: RUT REAL del cliente (Entidad CLIENTE_NACIONAL.identificador).
export interface ReceptorFacturaNacional {
  rut: string
  razonSocial: string
  giro: string | null
  direccion: string | null
  comuna: string | null
}

export interface LineaFacturaNacional {
  descripcion: string
  cantidad: number
  precioUnitario: number
  // Línea exenta de IVA → IndExe=1; afecta → sin IndExe (LibreDTE le aplica IVA).
  exento: boolean
}

// Referencia a otro DTE (IdDoc.Referencia). La Nota de Crédito nacional (61) la
// usa para referenciar la factura 33/34 que anula (CodRef=1).
export interface ReferenciaFacturaNacional {
  tpoDocRef: string // código SII del documento referenciado (33/34)
  folioRef: string
  fecha: string // YYYY-MM-DD (FchRef)
  codRef?: number // 1=anula, 2=corrige texto, 3=corrige montos
  razonRef?: string
}

export interface FacturaNacionalMapeo {
  // 33 (Afecta) o 34 (Exenta) para la factura; 61 para la Nota de Crédito.
  tipoDte: number
  fechaEmision: Date
  emisor: EmisorFacturaNacional
  receptor: ReceptorFacturaNacional
  lineas: LineaFacturaNacional[]
  // Forma de pago genérica del SII (1=contado, 2=crédito, 3=sin costo). Opcional.
  fmaPago?: number | null
  // Observaciones libres → IdDoc.TermPagoGlosa (glosa en el PDF).
  observaciones?: string | null
  referencias?: ReferenciaFacturaNacional[]
}

function fmtFecha(d: Date): string {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

// Arma el payload de la Factura Electrónica nacional (DTE 33 Afecta / 34 Exenta)
// para LibreDTE. Se envía con normalizar=1: LibreDTE calcula MntNeto, MntExe,
// IVA (19%) y MntTotal a partir del detalle (QtyItem × PrcItem, con IndExe por
// línea). Montos en CLP — sin OtraMoneda/TpoCambio ni bloque Aduana.
export function mapFacturaNacionalADte(data: FacturaNacionalMapeo): LibredteDtePayload {
  return {
    Encabezado: {
      IdDoc: {
        TipoDTE: data.tipoDte,
        FchEmis: fmtFecha(data.fechaEmision),
        ...(data.fmaPago != null ? { FmaPago: data.fmaPago } : {}),
        ...(data.observaciones?.trim() ? { TermPagoGlosa: data.observaciones.trim() } : {}),
      },
      Emisor: {
        RUTEmisor: data.emisor.rut,
        RznSoc: data.emisor.razonSocial,
        ...(data.emisor.giro ? { GiroEmis: data.emisor.giro } : {}),
        ...(data.emisor.direccion ? { DirOrigen: data.emisor.direccion } : {}),
        ...(data.emisor.comuna ? { CmnaOrigen: data.emisor.comuna } : {}),
      },
      Receptor: {
        RUTRecep: data.receptor.rut,
        RznSocRecep: data.receptor.razonSocial,
        ...(data.receptor.giro ? { GiroRecep: data.receptor.giro } : {}),
        ...(data.receptor.direccion ? { DirRecep: data.receptor.direccion } : {}),
        ...(data.receptor.comuna ? { CmnaRecep: data.receptor.comuna } : {}),
      },
      // Totales (MntNeto/MntExe/IVA/MntTotal) los deriva LibreDTE con normalizar=1.
    },
    Detalle: data.lineas.map((l, i) => ({
      NroLinDet: i + 1,
      NmbItem: l.descripcion,
      QtyItem: l.cantidad,
      PrcItem: l.precioUnitario,
      // Línea exenta: IndExe=1 (sin IVA). Afecta: se omite y LibreDTE le aplica IVA.
      ...(l.exento ? { IndExe: 1 } : {}),
    })),
    // Referencias (p. ej. la NC 61 referencia la factura 33/34 que anula).
    ...((data.referencias ?? []).length > 0
      ? {
          Referencia: (data.referencias ?? []).map((r, i) => ({
            NroLinRef: i + 1,
            TpoDocRef: r.tpoDocRef,
            FolioRef: r.folioRef,
            FchRef: r.fecha,
            ...(r.codRef != null ? { CodRef: r.codRef } : {}),
            ...(r.razonRef ? { RazonRef: r.razonRef } : {}),
          })),
        }
      : {}),
  }
}
