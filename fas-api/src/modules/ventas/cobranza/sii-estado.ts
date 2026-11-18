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

// Estados cuyo DTE timbrado (PDF/XML) sigue siendo descargable: los timbrados
// (ENVIADA_SII/APROBADA) y ANULADA (anulada con Nota de Crédito — el DTE original
// persiste en LibreDTE y se debe poder reimprimir). RECHAZADA queda fuera: el SII
// la rechazó, no es un documento válido aunque tenga folio.
export function esFacturaConDocumentoDescargable(estado: string): boolean {
  return esFacturaTimbrada(estado) || estado === 'ANULADA'
}

// Códigos del SII (revisión del envío y estado del documento). Se leen como
// palabra completa (\b) para no confundir un trozo de otra palabra o del JSON.
//
// ACEPTACIÓN:
//   EPR = envío procesado · RLV = DTE aceptado con reparos leves · RPR =
//   aceptado con reparos · DOK = documento recibido OK · DNK = recibido, datos
//   no coinciden (aceptado con observaciones).
// RLV/RPR (2026-11-18): antes RLV estaba en la lista de rechazo y una Factura
// "Aceptada con Reparos Leves" (LibreDTE: aceptada, código 804) quedaba
// RECHAZADA en FAS. Con reparos el DTE es VÁLIDO.
//
// RECHAZO:
//   RCH = DTE rechazado · RCT = error en carátula · RFR = error en firma ·
//   RCS/RSC = error en schema · RPT = repetido rechazado · FAU/FNA = documento
//   no autorizado / no recibido · FAN = anulado.
const CODIGOS_ACEPTADO = ['EPR', 'RLV', 'RPR', 'DOK', 'DNK']
const CODIGOS_RECHAZO = ['RCH', 'RCT', 'RFR', 'RCS', 'RSC', 'RPT', 'FAU', 'FNA', 'FAN']
const RE_CODIGO = (codigos: string[]) => new RegExp(`\\b(${codigos.join('|')})\\b`)
const CODIGO_ACEPTADO_RE = RE_CODIGO(CODIGOS_ACEPTADO)
const CODIGO_RECHAZO_RE = RE_CODIGO(CODIGOS_RECHAZO)
// Glosas: "aceptado con reparos" se evalúa ANTES que cualquier rechazo.
const GLOSA_ACEPTADO_CON_REPAROS = /aceptad[oa]s? con reparos/i
const GLOSA_RECHAZO = /rechaz|no v[aá]lid|anulad/i
const GLOSA_ACEPTADO = /aceptad|recibido( conforme)?|documento (recibido|correcto)|procesado( correctamente)?/i

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
  // 1) El código del campo de estado (revision_estado/estado, ej. "RLV - DTE
  //    Aceptado con Reparos Leves") manda: es la señal estructurada del SII.
  const codigo = codigoEstado(data)
  if (codigo) {
    if (CODIGOS_ACEPTADO.includes(codigo)) return { veredicto: 'ACEPTADO', glosa }
    if (CODIGOS_RECHAZO.includes(codigo)) return { veredicto: 'RECHAZADO', glosa }
  }
  // 2) Sin código reconocible: "aceptado con reparos" es aceptación aunque el
  //    resto del texto traiga palabras de rechazo; luego rechazo; luego aceptación.
  if (GLOSA_ACEPTADO_CON_REPAROS.test(texto)) return { veredicto: 'ACEPTADO', glosa }
  if (CODIGO_RECHAZO_RE.test(texto) || GLOSA_RECHAZO.test(texto)) return { veredicto: 'RECHAZADO', glosa }
  if (CODIGO_ACEPTADO_RE.test(texto) || GLOSA_ACEPTADO.test(texto)) return { veredicto: 'ACEPTADO', glosa }
  return { veredicto: 'PENDIENTE', glosa }
}

// Código SII de 3 letras al inicio de un campo de estado conocido ("RLV - …",
// "EPR", "DOK"…). Null si no hay campo o no empieza con un código.
function codigoEstado(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  for (const k of ['revision_estado', 'estado', 'ESTADO']) {
    const v = o[k]
    if (typeof v !== 'string') continue
    const m = /^\s*([A-Z]{3})\b/.exec(v.trim().toUpperCase())
    if (m && (CODIGOS_ACEPTADO.includes(m[1]) || CODIGOS_RECHAZO.includes(m[1]))) return m[1]
  }
  return null
}

// Factura en la que tiene sentido consultar el veredicto SII: timbrada, o
// RECHAZADA que ya tiene folio (fue timbrada y el veredicto la rechazó). Esto
// último permite re-verificar una Factura marcada RECHAZADA por error de
// interpretación (ej. RLV antes del 2026-11-18) sin reabrirla ni timbrar otra.
export function esFacturaConsultableSii(estado: string, folio: number | null | undefined): boolean {
  return folio != null && (esFacturaTimbrada(estado) || estado === 'RECHAZADA')
}
