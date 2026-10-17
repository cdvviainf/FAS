// Configuración de la auditoría — ÚNICO punto a ajustar al portar el módulo a
// otro proyecto: qué modelos NO se auditan y qué campos se enmascaran.

// Modelos Prisma que NO se auditan (ruido o datos sensibles de infraestructura).
// `AuditLog` se excluye SIEMPRE para evitar recursión.
export const MODELOS_EXCLUIDOS_AUDITORIA = new Set<string>([
  'AuditLog',
  // Better Auth / sesiones y credenciales
  'Session',
  'Account',
  'Verification',
])

// Nombres de campo que nunca deben persistirse en claro (match por substring,
// case-insensitive). Se reemplazan por '***'.
const PATRONES_SENSIBLES = ['password', 'passwordhash', 'token', 'secret', 'hash', 'apikey', 'api_key']

// Campos sensibles POR MODELO cuyo nombre no delata la sensibilidad (ej.
// IntegracionParametro.valorExterno guarda una credencial cifrada marcada en
// otro campo). Se enmascaran siempre, aunque el valor esté cifrado.
export const CAMPOS_SENSIBLES_POR_MODELO: Record<string, string[]> = {
  IntegracionParametro: ['valorExterno'],
}

// Claves cuyo valor es un blob/binario grande o ruidoso: se reemplazan por un
// placeholder en vez de volcarlo al log.
const PATRONES_BLOB = ['pdf', 'xml', 'imagen', 'avatar', 'archivo', 'adjunto', 'bytes', 'buffer']

function esSensible(clave: string): boolean {
  const k = clave.toLowerCase()
  return PATRONES_SENSIBLES.some((p) => k.includes(p))
}
function esBlob(clave: string, valor: unknown): boolean {
  const k = clave.toLowerCase()
  if (PATRONES_BLOB.some((p) => k.includes(p))) return true
  // Buffers / Uint8Array (columnas Bytes de Prisma).
  return valor instanceof Uint8Array || Buffer.isBuffer(valor)
}

// Enmascara un objeto de datos para persistir en el log: oculta sensibles,
// resume blobs y serializa valores no-JSON (Decimal, Date, BigInt).
export function enmascarar(valor: unknown): unknown {
  if (valor == null) return valor
  if (valor instanceof Uint8Array || Buffer.isBuffer(valor)) return '[binario]'
  if (valor instanceof Date) return valor.toISOString()
  if (typeof valor === 'bigint') return valor.toString()
  // Prisma.Decimal y similares exponen toString(); se serializan como texto.
  if (typeof valor === 'object' && valor !== null && 'toFixed' in (valor as object) && typeof (valor as { toString?: unknown }).toString === 'function') {
    return (valor as { toString: () => string }).toString()
  }
  if (Array.isArray(valor)) return valor.map((v) => enmascarar(v))
  if (typeof valor === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      if (esSensible(k)) out[k] = '***'
      else if (esBlob(k, v)) out[k] = '[binario]'
      else out[k] = enmascarar(v)
    }
    return out
  }
  return valor
}

// Enmascara un snapshot de un modelo concreto: primero oculta los campos
// sensibles declarados para ese modelo (por nombre exacto), luego aplica el
// enmascarado genérico (patrones de nombre + blobs + serialización).
export function enmascararModelo(model: string, valor: unknown): unknown {
  const campos = CAMPOS_SENSIBLES_POR_MODELO[model]
  if (campos && valor && typeof valor === 'object' && !Array.isArray(valor)) {
    const copia: Record<string, unknown> = { ...(valor as Record<string, unknown>) }
    for (const c of campos) {
      if (c in copia) copia[c] = '***'
    }
    return enmascarar(copia)
  }
  return enmascarar(valor)
}

// Calcula el diff campo-a-campo entre dos snapshots ya enmascarados. Devuelve
// solo las claves cuyo valor cambió: { campo: { antes, despues } }.
export function calcularDiff(
  antes: Record<string, unknown> | null,
  despues: Record<string, unknown> | null,
): Record<string, { antes: unknown; despues: unknown }> {
  const diff: Record<string, { antes: unknown; despues: unknown }> = {}
  const claves = new Set([...Object.keys(antes ?? {}), ...Object.keys(despues ?? {})])
  for (const k of claves) {
    const a = antes?.[k]
    const d = despues?.[k]
    if (JSON.stringify(a) !== JSON.stringify(d)) diff[k] = { antes: a, despues: d }
  }
  return diff
}
