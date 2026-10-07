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

// Datos de Aduana — todos opcionales acá, pero el service los valida como
// obligatorios antes de enviar al SII (validarCodigosAduana). Los códigos salen
// del campo `codigoAduana` de cada mantenedor (ClausulaVenta/TipoEmbarque/Puerto/
// Pais/Parametro), que es el código de la tabla de Aduana del SII — no el
// `codigo` de negocio. Lo que no venga, se omite y LibreDTE normaliza.
export interface AduanaFacturaExportacion {
  codModVenta: string | null // Parametro modalidadVenta.codigo
  codClauVenta: string | null // Parametro clausulaVenta.codigo (incoterm)
  totalClausulaVenta: number // valor cláusula/CIF = montoTotal de la factura
  // Flete y Seguro de la cláusula (CIF → ambos, C+F/CFR → solo flete, FOB →
  // ninguno). Monto cerrado dentro de TotClauVenta; el detalle va a valor FOB.
  montoFlete: number | null
  montoSeguro: number | null
  codViaTransp: string | null // según tipoEmbarque (marítimo/aéreo/terrestre)
  codPtoEmbarque: string | null // Puerto de zarpe .codigo
  codPtoDesembarque: string | null // Puerto de destino .codigo
  paisDestinoCodigo: string | null // Pais destino .codigo (Aduana)
  // Transporte (todos opcionales): compañía (naviera), nave, booking.
  nombreCiaTransp: string | null
  rutCiaTransp: string | null
  nombreTransp: string | null
  booking: string | null
  // Pesos (kilos) y bultos del embarque, derivados de las líneas y el envase.
  pesoNeto: number | null
  pesoBruto: number | null
  totItems: number | null
  totBultos: number | null
  // Tipo de bulto (SII): código, cantidad y, si hay, el contenedor.
  tipoBulto: { codTpoBultos: string; cantBultos: number; idContainer: string | null } | null
}

// Referencia del DTE (OC/DUS/BL). TpoDocRef = código SII (808=B/L, 807=DUS,
// 801=Orden de Compra). FchRef obligatoria.
export interface ReferenciaFacturaExportacion {
  tpoDocRef: string
  folioRef: string
  fecha: string // YYYY-MM-DD
  razonRef?: string
}

export interface FacturaExportacionMapeo {
  fechaEmision: Date
  monedaAduana: string // nombre de la moneda según tabla de Aduana (ej. "DOLAR USA")
  // Tipo de cambio (pesos por unidad de la moneda extranjera). Si viene, se
  // emite Encabezado.OtraMoneda (PESO CL + TpoCambio) — el SII lo exige en el
  // DTE 110 para expresar el equivalente en pesos. Null cuando la moneda ya es
  // CLP o no se capturó.
  tipoCambio: number | null
  emisor: EmisorFacturaExportacion
  receptor: ReceptorFacturaExportacion
  lineas: LineaFacturaExportacion[]
  aduana: AduanaFacturaExportacion
  referencias?: ReferenciaFacturaExportacion[]
  // Observaciones libres del documento. Se emiten como IdDoc.TermPagoGlosa, el
  // campo que LibreDTE imprime como glosa/observaciones en el PDF (máx. 100
  // caracteres según el SII; el schema de entrada ya lo acota).
  observaciones?: string | null
}

// RUT genérico de receptor extranjero para DTE de exportación (norma SII).
const RUT_RECEPTOR_EXTRANJERO = '55555555-5'

function fmtFecha(d: Date): string {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

// Unidades de peso de la tabla de Aduana del SII: KN = kilos netos, KB = kilos
// brutos (cada peso lleva la suya — FAS-EXP-ADU-QA-003).
const COD_UNID_PESO_NETO = 'KN'
const COD_UNID_PESO_BRUTO = 'KB'

function buildAduana(a: AduanaFacturaExportacion): Record<string, unknown> {
  return {
    ...(a.codModVenta ? { CodModVenta: a.codModVenta } : {}),
    ...(a.codClauVenta ? { CodClauVenta: a.codClauVenta } : {}),
    TotClauVenta: a.totalClausulaVenta,
    ...(a.nombreTransp ? { NombreTransp: a.nombreTransp } : {}),
    ...(a.rutCiaTransp ? { RUTCiaTransp: a.rutCiaTransp } : {}),
    ...(a.nombreCiaTransp ? { NombreCiaTransp: a.nombreCiaTransp } : {}),
    ...(a.booking ? { Booking: a.booking } : {}),
    ...(a.codViaTransp ? { CodViaTransp: a.codViaTransp } : {}),
    ...(a.codPtoEmbarque ? { CodPtoEmbarque: a.codPtoEmbarque } : {}),
    ...(a.codPtoDesembarque ? { CodPtoDesemb: a.codPtoDesembarque } : {}),
    ...(a.pesoBruto != null ? { PesoBruto: a.pesoBruto, CodUnidPesoBruto: COD_UNID_PESO_BRUTO } : {}),
    ...(a.pesoNeto != null ? { PesoNeto: a.pesoNeto, CodUnidPesoNeto: COD_UNID_PESO_NETO } : {}),
    ...(a.totItems != null ? { TotItems: a.totItems } : {}),
    ...(a.totBultos != null ? { TotBultos: a.totBultos } : {}),
    ...(a.tipoBulto
      ? {
          TipoBultos: [
            {
              CodTpoBultos: a.tipoBulto.codTpoBultos,
              CantBultos: a.tipoBulto.cantBultos,
              ...(a.tipoBulto.idContainer ? { IdContainer: a.tipoBulto.idContainer } : {}),
            },
          ],
        }
      : {}),
    ...(a.montoFlete != null ? { MntFlete: a.montoFlete } : {}),
    ...(a.montoSeguro != null ? { MntSeguro: a.montoSeguro } : {}),
    ...(a.paisDestinoCodigo ? { CodPaisRecep: a.paisDestinoCodigo } : {}),
  }
}

// Arma el payload de la Factura de Exportación Electrónica (DTE 110) para
// LibreDTE. Se envía con normalizar=1: LibreDTE completa totales, DV y campos
// derivados. Los montos van en la moneda extranjera de la factura (TpoMoneda).
export function mapFacturaExportacionA110(data: FacturaExportacionMapeo): LibredteDtePayload {
  return {
    Encabezado: {
      IdDoc: {
        TipoDTE: 110,
        FchEmis: fmtFecha(data.fechaEmision),
        // Glosa/observaciones del documento (LibreDTE la imprime en el PDF).
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
        RUTRecep: RUT_RECEPTOR_EXTRANJERO,
        RznSocRecep: data.receptor.razonSocial,
        ...(data.receptor.giro ? { GiroRecep: data.receptor.giro } : {}),
        ...(data.receptor.direccion ? { DirRecep: data.receptor.direccion } : {}),
        Extranjero: {
          ...(data.receptor.identificador ? { NumId: data.receptor.identificador } : {}),
          ...(data.receptor.nacionalidadCodigo ? { Nacionalidad: data.receptor.nacionalidadCodigo } : {}),
        },
      },
      // Sección de Aduana (obligatoria en la 110) — va DENTRO de Transporte
      // según el esquema del SII, no al mismo nivel que el resto del Encabezado
      // (confirmado por soporte LibreDTE 2026-10-07: el borrador temporal no
      // valida contra el XSD, pero el DTE real sí, y rechaza Aduana fuera de
      // Transporte). Antes iba como Encabezado.Aduana y el normalizador de
      // LibreDTE descartaba naviera/nave/booking/pesos/bultos/puerto de embarque.
      Transporte: { Aduana: buildAduana(data.aduana) },
      // Equivalente en pesos: el SII exige el tipo de cambio cuando el documento
      // se emite en moneda extranjera. Con normalizar=1, LibreDTE deriva los
      // montos en pesos a partir de TpoCambio. Se omite si la moneda ya es CLP.
      ...(data.tipoCambio != null && data.tipoCambio > 0
        ? { OtraMoneda: { TpoMoneda: 'PESO CL', TpoCambio: data.tipoCambio } }
        : {}),
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
    // Referencias (B/L, DUS, OC…) — solo si hay. TpoDocRef = código SII.
    ...((data.referencias ?? []).length > 0
      ? {
          Referencia: (data.referencias ?? []).map((r, i) => ({
            NroLinRef: i + 1,
            TpoDocRef: r.tpoDocRef,
            FolioRef: r.folioRef,
            FchRef: r.fecha,
            ...(r.razonRef ? { RazonRef: r.razonRef } : {}),
          })),
        }
      : {}),
  }
}
