import { env } from '../../../config/env.js'
import * as integracionesRepo from '../../config/integraciones/integraciones.repository.js'

// Adapter AGL360 (ventas.md §4.3) — mismo patrón documentado para el
// proveedor DTE en CLAUDE.md: `AGL_PROVIDER=mock|agl360` decide la
// implementación real, sin que el resto del código sepa cuál está activa.
// A diferencia del primer borrador (armado antes de tener la definición
// real), la URL y el token ya NO vienen de variables de entorno: se leen del
// mantenedor de Integraciones (Configuración → Integraciones, código
// 'AGL360') para poder configurarse por empresa sin redeploy — ver
// Docs/integraciones.md. `AGL_PROVIDER` sigue siendo una variable de entorno
// porque es un flag de ambiente (dev/test vs producción), no un dato de
// negocio por empresa.
//
// Payload y contrato de respuesta según Docs/api-solicitudes.md (2026-09-07).

const CODIGO_INTEGRACION = 'AGL360'

export interface SolicitudAglPayload {
  referencia_externa: string
  idCliente: number
  fechaSolicitud: string // YYYY-MM-DD
  idTipoEmbarque: number
  cantidadServicios: number
  idConsignee?: number
  idPod?: number
  idProducto?: number
  direccionRetiro?: string
  observaciones?: string
}

export interface SolicitudAglResultado {
  ok: boolean
  payloadRespuesta?: unknown
  error?: string
}

export async function crearSolicitud(payload: SolicitudAglPayload): Promise<SolicitudAglResultado> {
  if (env.AGL_PROVIDER === 'mock') return crearMock(payload)
  return crearReal(payload)
}

// AGL_MOCK_FALLA=true (solo dev/test) simula una integración caída, para
// poder probar el flujo "Generar Embarque sin reserva" sin depender de que
// AGL360 esté configurado.
async function crearMock(payload: SolicitudAglPayload): Promise<SolicitudAglResultado> {
  if (process.env.AGL_MOCK_FALLA === 'true') {
    return { ok: false, error: 'AGL360 no disponible (mock configurado para fallar)' }
  }
  return {
    ok: true,
    payloadRespuesta: {
      mock: true,
      id: 0,
      estado: 'pendiente',
      origen: 'api',
      referencia_externa: payload.referencia_externa,
    },
  }
}

async function crearReal(payload: SolicitudAglPayload): Promise<SolicitudAglResultado> {
  const integracion = await integracionesRepo.getIntegracionActivaPorCodigo(CODIGO_INTEGRACION)
  if (!integracion || !integracion.url) {
    return { ok: false, error: 'AGL360 no está configurado — falta la Integración "AGL360" (o su URL) en Configuración → Integraciones' }
  }
  const token = await integracionesRepo.getValorParametro(CODIGO_INTEGRACION, 'TOKEN')
  if (!token) {
    return { ok: false, error: 'AGL360 no está configurado — falta el parámetro TOKEN en la Integración "AGL360"' }
  }

  try {
    const res = await fetch(`${integracion.url.replace(/\/$/, '')}/api/solicitudes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    })
    const body = await res.json().catch(() => null)

    // 201 = creada, 200 = ya existía la misma referencia_externa (idempotente,
    // devuelve la existente) — ambos son éxito (Docs/api-solicitudes.md).
    if (res.status === 201 || res.status === 200) {
      return { ok: true, payloadRespuesta: body }
    }
    if (res.status === 422) {
      const detalle = body?.message ?? 'Error de validación'
      return { ok: false, error: `AGL360 rechazó la solicitud: ${detalle}` }
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: `AGL360 respondió ${res.status} — revisa el TOKEN configurado en Integraciones` }
    }
    return { ok: false, error: `AGL360 respondió ${res.status}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error de red al contactar AGL360' }
  }
}
