import { env } from '../../../config/env.js'
import * as integracionesRepo from '../../config/integraciones/integraciones.repository.js'
import type {
  LibredteDtePayload,
  LibredteEmitirOpts,
  LibredteGenerarInput,
  LibredteGenerarOpts,
  LibredteResultado,
} from './libredte.types.js'

// Adapter LibreDTE (https://www.libredte.cl/docs/api) — mismo patrón que
// agl360.adapter.ts (ver ventas/embarques): la URL y el hash de autenticación
// NO viven en variables de entorno, se configuran en el mantenedor de
// Integraciones (Configuración → Integraciones, código 'LIBREDTE') para
// poder rotarse/editarse por empresa sin redeploy. `DTE_PROVIDER=libredte` y
// `DTE_AMBIENTE` sí viven en env porque son flags de ambiente (qué
// implementación usar, cert vs prod), no datos de negocio por empresa.
//
// La emisión real de LibreDTE es de DOS pasos independientes:
//   1. emitirTemporal() -> POST /api/dte/documentos/emitir  (borrador, NO consume folio)
//   2. generarReal()    -> POST /api/dte/documentos/generar (timbra, consume folio CAF, puede enviar al SII)
//
// Este adapter es un wrapper delgado: no decide normalizar/formato/retry por
// defecto — eso lo decide quien lo llama (script de prueba o, más adelante,
// el service de Facturación), porque son decisiones de negocio (p.ej. "no
// reintentar envío al SII automáticamente" es una decisión del caller).

const CODIGO_INTEGRACION = 'LIBREDTE'
const BASE_URL_DEFAULT = 'https://libredte.cl'
const PARAM_API_HASH = 'API_HASH'

interface Credenciales {
  baseUrl: string
  hash: string
}

async function getCredenciales(): Promise<Credenciales | { error: string }> {
  const integracion = await integracionesRepo.getIntegracionActivaPorCodigo(CODIGO_INTEGRACION)
  if (!integracion) {
    return { error: 'LibreDTE no está configurado — falta la Integración "LIBREDTE" en Configuración → Integraciones' }
  }
  const hash = await integracionesRepo.getValorParametro(CODIGO_INTEGRACION, PARAM_API_HASH)
  if (!hash) {
    return { error: 'LibreDTE no está configurado — falta el parámetro API_HASH en la Integración "LIBREDTE"' }
  }
  return { baseUrl: (integracion.url || BASE_URL_DEFAULT).replace(/\/$/, ''), hash }
}

function authHeader(hash: string): string {
  return `Basic ${Buffer.from(`X:${hash}`).toString('base64')}`
}

// `_contribuyente_certificacion`: 0 = producción, 1 = certificación.
function paramCertificacion(): string {
  return env.DTE_AMBIENTE === 'produccion' ? '0' : '1'
}

async function request<T>(
  path: string,
  method: 'GET' | 'POST',
  opts: { query?: Record<string, string | undefined>; body?: unknown } = {},
): Promise<LibredteResultado<T>> {
  const creds = await getCredenciales()
  if ('error' in creds) return { ok: false, error: creds.error }

  const url = new URL(`${creds.baseUrl}${path}`)
  url.searchParams.set('_contribuyente_certificacion', paramCertificacion())
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, v)
  }

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: authHeader(creds.hash),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(30_000),
    })
    const data = (await res.json().catch(() => null)) as (T & { message?: string }) | string | null
    if (res.ok) return { ok: true, status: res.status, data: data as T }
    // LibreDTE a veces responde el error como string plano (no `{message}`)
    // — ej. "No existe una firma electrónica asociada...". Se usa tal cual.
    const detalle = typeof data === 'string' ? data : (data?.message ?? `LibreDTE respondió ${res.status}`)
    return { ok: false, status: res.status, data: data as T, error: detalle }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error de red al contactar LibreDTE' }
  }
}

// POST /api/dte/documentos/emitir — crea el DTE temporal (borrador).
// Responde con { codigo, ... } — el `codigo` es el vínculo con generarReal().
export async function emitirTemporal(
  dte: LibredteDtePayload,
  opts: LibredteEmitirOpts = {},
): Promise<LibredteResultado<{ codigo: string; [campo: string]: unknown }>> {
  return request('/api/dte/documentos/emitir', 'POST', {
    query: { normalizar: opts.normalizar, formato: opts.formato, links: opts.links, email: opts.email },
    body: dte,
  })
}

// POST /api/dte/documentos/generar — timbra el DTE real a partir del temporal.
export async function generarReal(input: LibredteGenerarInput, opts: LibredteGenerarOpts = {}): Promise<LibredteResultado> {
  return request('/api/dte/documentos/generar', 'POST', {
    query: { getXML: opts.getXML, links: opts.links, email: opts.email, retry: opts.retry, gzip: opts.gzip },
    body: input,
  })
}

// GET /api/dte/contribuyentes/info/{rut} — datos semi-públicos de un contribuyente.
export async function consultarContribuyente(rut: string): Promise<LibredteResultado> {
  return request(`/api/dte/contribuyentes/info/${encodeURIComponent(rut)}`, 'GET')
}

// GET /api/dte/contribuyentes/config/{rut} — ambiente activo y documentos habilitados.
export async function consultarConfigContribuyente(rut: string): Promise<LibredteResultado> {
  return request(`/api/dte/contribuyentes/config/${encodeURIComponent(rut)}`, 'GET')
}

// GET /api/dte/dte_emitidos/estado/{dte}/{folio}/{emisor} — validación de
// datos de un DTE emitido enviado al SII (RUTs sin DV en los path params).
export async function consultarEstadoEmitido(dte: number, folio: number, emisorSinDv: number): Promise<LibredteResultado> {
  return request(`/api/dte/dte_emitidos/estado/${dte}/${folio}/${emisorSinDv}`, 'GET')
}
