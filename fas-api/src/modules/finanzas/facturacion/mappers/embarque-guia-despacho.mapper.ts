import type { ContraparteDte } from '../dte-emitidos.types.js'
import type { LibredteDtePayload } from '../libredte.types.js'

// Contraparte ya resuelta y validada (rut presente) — la validación de "el
// emisor/receptor debe tener RUT" vive en el service (mensaje de negocio
// específico); este mapper es un transform puro que no valida ni lanza.
type ContraparteResuelta = Omit<ContraparteDte, 'rut'> & { rut: string }

export interface EmbarqueGuiaLineaMapeo {
  descripcion: string
  cajas: number
  pesoNetoKg: number
  // Precio unitario por caja — solo se emite si el traslado es Venta (IndTraslado=1);
  // en traslados sin venta se omite (norma SII / instrucción de negocio).
  precioUnitario?: number | null
}

// Bloque Aduana del DTE 52 de EXPORTACIÓN (IndTraslado=8), mismo patrón que la
// Factura de Exportación DTE 110. Los códigos vienen de los `codigoAduana` de
// los mantenedores (cláusula/modalidad/vía/puertos/país) de la Nota de Venta.
export interface AduanaGuiaDespacho {
  codModVenta?: string | null
  codClauVenta?: string | null
  totClauVenta?: number | null
  codViaTransp?: string | null
  codPtoEmbarque?: string | null
  codPtoDesembarque?: string | null
  paisDestinoCodigo?: string | null
  pesoBruto?: number | null
  pesoNeto?: number | null
  totItems?: number | null
  totBultos?: number | null
}

export interface EmbarqueGuiaDespachoMapeo {
  // YYYY-MM-DD
  fechaEmision: string
  // IndTraslado SII: 1=Venta, 2=Ventas por efectuar, 3=Consignación,
  // 4=Entrega gratuita, 5=Traslado interno, 6=Otros, 7=Devolución,
  // 8=Traslado para exportación (no venta).
  indTraslado: number
  emisor: ContraparteResuelta
  receptor: ContraparteResuelta
  transporte: {
    transportistaRut: string | null
    transportistaRazonSocial: string | null
    choferRut: string | null
    choferNombre: string | null
    patenteCamion: string | null
    patenteRemolque: string | null
  }
  // Dirección + comuna EXACTAS de origen (Planta) y destino (Puerto de zarpe),
  // editables en el popup. Origen va en Emisor.DirOrigen/CmnaOrigen; destino en
  // Transporte.DirDest/CmnaDest (tags del SII para la Guía de Despacho).
  origen: { direccion: string | null; comuna: string | null }
  destino: { direccion: string | null; comuna: string | null }
  detalle: EmbarqueGuiaLineaMapeo[]
  // Bloque Aduana — solo en la Guía de EXPORTACIÓN (IndTraslado=8).
  aduana?: AduanaGuiaDespacho | null
}

const INDTRASLADO_VENTA = 1
// Traslado para exportación (no constituye venta): la fruta se despacha a $1 por
// caja, exenta (sin IVA), y lleva el bloque Aduana. Decisión de negocio (ejemplo
// real Agrosan, 2026-10-19).
const INDTRASLADO_EXPORTACION = 8
const PRECIO_EXPORTACION_POR_CAJA = 1

function buildAduanaGuia(a: AduanaGuiaDespacho): Record<string, unknown> {
  return {
    ...(a.codModVenta ? { CodModVenta: a.codModVenta } : {}),
    ...(a.codClauVenta ? { CodClauVenta: a.codClauVenta } : {}),
    ...(a.totClauVenta != null ? { TotClauVenta: a.totClauVenta } : {}),
    ...(a.codViaTransp ? { CodViaTransp: a.codViaTransp } : {}),
    ...(a.codPtoEmbarque ? { CodPtoEmbarque: a.codPtoEmbarque } : {}),
    ...(a.codPtoDesembarque ? { CodPtoDesemb: a.codPtoDesembarque } : {}),
    // Unidad de peso = código numérico de 2 dígitos del Anexo 51 de Aduana
    // (Kilo Bruto = 36, Kilo Neto = 06), no la sigla (el SII rechaza 'KB'/'KN').
    ...(a.pesoBruto != null ? { PesoBruto: a.pesoBruto, CodUnidPesoBruto: '36' } : {}),
    ...(a.pesoNeto != null ? { PesoNeto: a.pesoNeto, CodUnidPesoNeto: '06' } : {}),
    ...(a.totItems != null ? { TotItems: a.totItems } : {}),
    ...(a.totBultos != null ? { TotBultos: a.totBultos } : {}),
    // País receptor y país destino: mismo país del cliente.
    ...(a.paisDestinoCodigo ? { CodPaisRecep: a.paisDestinoCodigo } : {}),
    ...(a.paisDestinoCodigo ? { CodPaisDestin: a.paisDestinoCodigo } : {}),
  }
}

function buildTransporte(
  t: EmbarqueGuiaDespachoMapeo['transporte'],
  destino: EmbarqueGuiaDespachoMapeo['destino'],
): Record<string, unknown> | undefined {
  const hayTransporte = t.patenteCamion || t.choferRut || t.transportistaRut
  const hayDestino = destino.direccion || destino.comuna
  if (!hayTransporte && !hayDestino) return undefined
  return {
    ...(t.patenteCamion ? { Patente: t.patenteCamion } : {}),
    ...(t.transportistaRut ? { RUTTrans: t.transportistaRut } : {}),
    ...(t.transportistaRazonSocial ? { NombreTrans: t.transportistaRazonSocial } : {}),
    ...(destino.direccion ? { DirDest: destino.direccion } : {}),
    ...(destino.comuna ? { CmnaDest: destino.comuna } : {}),
    ...(t.patenteRemolque ? { Remolque: { Patente: t.patenteRemolque } } : {}),
    ...(t.choferRut || t.choferNombre
      ? {
          Chofer: {
            ...(t.choferRut ? { RUTChofer: t.choferRut } : {}),
            ...(t.choferNombre ? { NombreChofer: t.choferNombre } : {}),
          },
        }
      : {}),
  }
}

export function mapEmbarqueAGuiaDespacho(data: EmbarqueGuiaDespachoMapeo): LibredteDtePayload {
  const esVenta = data.indTraslado === INDTRASLADO_VENTA
  const esExportacion = data.indTraslado === INDTRASLADO_EXPORTACION
  let transporte = buildTransporte(data.transporte, data.destino)
  // El bloque Aduana de la Guía de exportación va DENTRO de Transporte (mismo
  // lugar que en el DTE 110, confirmado con soporte LibreDTE).
  if (esExportacion && data.aduana) {
    transporte = { ...(transporte ?? {}), Aduana: buildAduanaGuia(data.aduana) }
  }
  return {
    Encabezado: {
      IdDoc: { TipoDTE: 52, IndTraslado: data.indTraslado, FchEmis: data.fechaEmision },
      Emisor: {
        RUTEmisor: data.emisor.rut,
        ...(data.emisor.giro ? { GiroEmisor: data.emisor.giro } : {}),
        // Origen de la mercadería (Planta) — editable; si no vino, cae a la
        // dirección por defecto de la empresa emisora.
        ...(data.origen.direccion ?? data.emisor.direccion
          ? { DirOrigen: data.origen.direccion ?? data.emisor.direccion }
          : {}),
        ...(data.origen.comuna ?? data.emisor.comuna
          ? { CmnaOrigen: data.origen.comuna ?? data.emisor.comuna }
          : {}),
      },
      Receptor: {
        RUTRecep: data.receptor.rut,
        RznSocRecep: data.receptor.razonSocial,
        ...(data.receptor.giro ? { GiroRecep: data.receptor.giro } : {}),
        ...(data.receptor.direccion ? { DirRecep: data.receptor.direccion } : {}),
        ...(data.receptor.comuna ? { CmnaRecep: data.receptor.comuna } : {}),
      },
      ...(transporte ? { Transporte: transporte } : {}),
    },
    Detalle: data.detalle.map((d) => ({
      NmbItem: d.descripcion,
      QtyItem: d.cajas,
      UnmdItem: 'CJ',
      // Peso neto total de la línea como ítem informativo del SII.
      ...(d.pesoNetoKg > 0 ? { DscItem: `Peso neto: ${d.pesoNetoKg} kg` } : {}),
      // Exportación (IndTraslado 8): $1 por caja, exento (IndExe=1, sin IVA).
      // Venta: precio real. Otros traslados sin venta: sin precio.
      ...(esExportacion
        ? { PrcItem: PRECIO_EXPORTACION_POR_CAJA, IndExe: 1 }
        : esVenta && d.precioUnitario != null
          ? { PrcItem: d.precioUnitario }
          : {}),
    })),
  }
}
