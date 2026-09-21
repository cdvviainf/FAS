import type { ContraparteDte } from '../dte-emitidos.types.js'
import type { LibredteDtePayload } from '../libredte.types.js'

// Contraparte ya resuelta y validada (rut presente) — la validación de "el
// emisor/receptor debe tener RUT" vive en movimientos.service.ts (mensaje de
// negocio específico), este mapper es un transform puro que no valida ni lanza.
type ContraparteResuelta = Omit<ContraparteDte, 'rut'> & { rut: string }

export interface MovimientoParaDteMapeo {
  indTrasladoSii: number
  detalle: Array<{ articuloDescripcion: string; cantidad: number }>
  transporte: {
    transportistaRut: string | null
    transportistaRazonSocial: string | null
    choferRut: string | null
    choferNombre: string | null
    placaCamion: string | null
    placaRemolque: string | null
  }
  emisor: ContraparteResuelta
  receptor: ContraparteResuelta
}

// Tags de Transporte dentro de Encabezado — best-effort (Docs de LibreDTE
// espejan el XML del SII 1:1 pero no documentan cada tag de Guía de
// Despacho). Sin impacto de riesgo en esta ronda: emitirTemporal() no valida
// contra el SII, solo arma el borrador — si algún nombre de tag no calza, se
// ajusta al implementar Fase 2 (generarReal, que sí timbra).
function buildTransporte(t: MovimientoParaDteMapeo['transporte']): Record<string, unknown> | undefined {
  if (!t.placaCamion && !t.choferRut && !t.transportistaRut) return undefined
  return {
    ...(t.placaCamion ? { Patente: t.placaCamion } : {}),
    ...(t.placaRemolque ? { PatenteDest: t.placaRemolque } : {}),
    ...(t.transportistaRut ? { RUTTrans: t.transportistaRut } : {}),
    ...(t.transportistaRazonSocial ? { NombreTrans: t.transportistaRazonSocial } : {}),
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

export function mapMovimientoAGuiaDespachoTemporal(data: MovimientoParaDteMapeo): LibredteDtePayload {
  const transporte = buildTransporte(data.transporte)
  return {
    Encabezado: {
      IdDoc: { TipoDTE: 52, IndTraslado: data.indTrasladoSii },
      Emisor: {
        RUTEmisor: data.emisor.rut,
        ...(data.emisor.giro ? { GiroEmisor: data.emisor.giro } : {}),
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
      ...(transporte ? { Transporte: transporte } : {}),
    },
    Detalle: data.detalle.map((d) => ({ NmbItem: d.articuloDescripcion, QtyItem: d.cantidad })),
  }
}
