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

export interface EmbarqueGuiaDespachoMapeo {
  // YYYY-MM-DD
  fechaEmision: string
  // IndTraslado SII: 1=Venta, 2=Ventas por efectuar, 3=Consignación,
  // 4=Entrega gratuita, 5=Traslado interno, 6=Otros, 7=Devolución...
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
}

const INDTRASLADO_VENTA = 1

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
  const transporte = buildTransporte(data.transporte, data.destino)
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
      ...(esVenta && d.precioUnitario != null ? { PrcItem: d.precioUnitario } : {}),
    })),
  }
}
