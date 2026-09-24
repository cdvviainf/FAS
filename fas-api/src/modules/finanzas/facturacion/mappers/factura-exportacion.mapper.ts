import type { LibredteDtePayload } from '../libredte.types.js'

// Emisor ya resuelto (empresa Agrosan) — rut garantizado por el service.
export interface EmisorFacturaExportacion {
  rut: string
  razonSocial: string
  giro: string | null
  direccion: string | null
  comuna: string | null
}

// Receptor extranjero (cliente de exportación). En DTE 110 el RUT del receptor
// es el genérico de extranjeros; la identificación real va en Extranjero.NumId.
export interface ReceptorFacturaExportacion {
  razonSocial: string
  identificador: string | null // NumId extranjero (RUT/Tax ID del cliente)
  giro: string | null
  direccion: string | null
  // Código de nacionalidad del cliente según tabla de Aduana del SII.
  nacionalidadCodigo: string | null
}

export interface LineaFacturaExportacion {
  descripcion: string
  cantidadCajas: number
  precioUnitario: number
}

// Datos de Aduana — todos opcionales; se toman de los mantenedores (Parametro/
// Puerto/Pais) donde el `codigo` debe corresponder a la tabla de Aduana del SII
// (a validar con el cliente). Lo que no venga, se omite y LibreDTE normaliza.
export interface AduanaFacturaExportacion {
  codModVenta: string | null // Parametro modalidadVenta.codigo
  codClauVenta: string | null // Parametro clausulaVenta.codigo (incoterm)
  totalClausulaVenta: number // monto FOB/cláusula = montoTotal de la factura
  codViaTransp: string | null // según tipoEmbarque (marítimo/aéreo/terrestre)
  codPtoEmbarque: string | null // Puerto de zarpe .codigo
  codPtoDesembarque: string | null // Puerto de destino .codigo
  paisDestinoCodigo: string | null // Pais destino .codigo (Aduana)
}

export interface FacturaExportacionMapeo {
  fechaEmision: Date
  monedaAduana: string // nombre de la moneda según tabla de Aduana (ej. "DOLAR USA")
  emisor: EmisorFacturaExportacion
  receptor: ReceptorFacturaExportacion
  lineas: LineaFacturaExportacion[]
  aduana: AduanaFacturaExportacion
}

// RUT genérico de receptor extranjero para DTE de exportación (norma SII).
const RUT_RECEPTOR_EXTRANJERO = '55555555-5'

function fmtFecha(d: Date): string {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

function buildAduana(a: AduanaFacturaExportacion): Record<string, unknown> {
  return {
    ...(a.codModVenta ? { CodModVenta: a.codModVenta } : {}),
    ...(a.codClauVenta ? { CodClauVenta: a.codClauVenta } : {}),
    TotClauVenta: a.totalClausulaVenta,
    ...(a.codViaTransp ? { CodViaTransp: a.codViaTransp } : {}),
    ...(a.codPtoEmbarque ? { CodPtoEmbarque: a.codPtoEmbarque } : {}),
    ...(a.codPtoDesembarque ? { CodPtoDesemb: a.codPtoDesembarque } : {}),
    ...(a.paisDestinoCodigo ? { CodPaisRecep: a.paisDestinoCodigo } : {}),
  }
}

// Arma el payload de la Factura de Exportación Electrónica (DTE 110) para
// LibreDTE. Se envía con normalizar=1: LibreDTE completa totales, DV y campos
// derivados. Los montos van en la moneda extranjera de la factura (TpoMoneda).
export function mapFacturaExportacionA110(data: FacturaExportacionMapeo): LibredteDtePayload {
  return {
    Encabezado: {
      IdDoc: { TipoDTE: 110, FchEmis: fmtFecha(data.fechaEmision) },
      Emisor: {
        RUTEmisor: data.emisor.rut,
        RznSoc: data.emisor.razonSocial,
        ...(data.emisor.giro ? { GiroEmis: data.emisor.giro } : {}),
        ...(data.emisor.direccion ? { DirOrigen: data.emisor.direccion } : {}),
        ...(data.emisor.comuna ? { CmnaOrigen: data.emisor.comuna } : {}),
      },
      Receptor: {
        RUTRecep: RUT_RECEPTOR_EXTRANJERO,
        RznSocRecep: data.receptor.razonSocial,
        ...(data.receptor.giro ? { GiroRecep: data.receptor.giro } : {}),
        ...(data.receptor.direccion ? { DirRecep: data.receptor.direccion } : {}),
        Extranjero: {
          ...(data.receptor.identificador ? { NumId: data.receptor.identificador } : {}),
          ...(data.receptor.nacionalidadCodigo ? { Nacionalidad: data.receptor.nacionalidadCodigo } : {}),
        },
      },
      // Sección de Aduana (obligatoria en la 110).
      Aduana: buildAduana(data.aduana),
      // Moneda extranjera de la operación (tabla de Aduana del SII).
      Totales: { TpoMoneda: data.monedaAduana },
    },
    Detalle: data.lineas.map((l, i) => ({
      NroLinDet: i + 1,
      NmbItem: l.descripcion,
      QtyItem: l.cantidadCajas,
      PrcItem: l.precioUnitario,
      // Exportación: ítems no afectos a IVA.
      IndExe: 1,
    })),
  }
}
