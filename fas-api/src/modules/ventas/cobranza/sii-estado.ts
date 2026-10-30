// Reconciliación del estado real del SII para Facturas (export/nacional).
//
// El flujo de firma marca la Factura como ENVIADA_SII en cuanto LibreDTE timbra
// y devuelve folio, PERO el veredicto del SII (aceptado/rechazado) es posterior
// y asíncrono. Este módulo interpreta la respuesta de `consultarEstadoEmitido`
// (GET /api/dte/dte_emitidos/estado/...) para decidir si el documento quedó
// ACEPTADO, RECHAZADO o sigue PENDIENTE de veredicto.
//
// FAIL-SAFE: solo se cambia el estado ante una señal CLARA. Si la respuesta no
// es concluyente (formato inesperado, aún en cola del SII), se devuelve
// PENDIENTE y la Factura NO cambia de estado — nunca se "aprueba" por defecto.

export type EstadoFacturaTimbrable = 'BORRADOR' | 'ENVIADA_SII' | 'APROBADA' | 'RECHAZADA' | 'ANULADA'

// Estados en los que la Factura ya está timbrada (tiene folio y DTE real). Se
// tratan por igual para PDF, cobranza y anulación con Nota de Crédito: la
// distinción ENVIADA_SII vs APROBADA es solo el veredicto del SII, no afecta la
// validez comercial del documento timbrado.
export function esFacturaTimbrada(estado: string): boolean {
  return estado === 'ENVIADA_SII' || estado === 'APROBADA'
}

// Códigos/glosas de RECHAZO del SII (revisión de envío + estado de documento).
// RCH/RFR/RCT/RLV = rechazos de envío; FAU/FNA = firma/autorización; más glosas.
const RECHAZO_SII = /rechaz|"?rch"?|"?rfr"?|"?rct"?|"?rlv"?|"?fau"?|"?fna"?|no v[aá]lid|anulad/i
// Códigos/glosas de ACEPTACIÓN. DOK = documento OK; DNK = recibido con reparos
// (aceptado con observaciones); EPR = envío procesado. Más glosas habituales.
const ACEPTADO_SII = /"?dok"?|"?dnk"?|"?epr"?|aceptad|recibido( conforme)?|documento (recibido|correcto)|procesado( correctamente)?/i

export type VeredictoSii = { veredicto: 'ACEPTADO' | 'RECHAZADO' | 'PENDIENTE'; glosa: string }

// Intenta extraer una glosa legible de la respuesta de LibreDTE; si no hay un
// campo conocido, cae al JSON crudo truncado.
function extraerGlosa(data: unknown): string {
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>
    for (const k of ['glosa', 'revision_detalle', 'revision_estado', 'estado', 'mensaje', 'detalle', 'DETALLE', 'ESTADO']) {
      const v = o[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
  }
  return JSON.stringify(data).slice(0, 500)
}

export function interpretarEstadoSii(data: unknown): VeredictoSii {
  const texto = JSON.stringify(data) ?? ''
  const glosa = extraerGlosa(data)
  // Rechazo primero: una señal de rechazo manda sobre cualquier otra.
  if (RECHAZO_SII.test(texto)) return { veredicto: 'RECHAZADO', glosa }
  if (ACEPTADO_SII.test(texto)) return { veredicto: 'ACEPTADO', glosa }
  return { veredicto: 'PENDIENTE', glosa }
}
