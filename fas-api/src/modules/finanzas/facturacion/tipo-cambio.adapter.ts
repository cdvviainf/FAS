// Tipo de cambio observado (CLP por 1 unidad de moneda extranjera) para DTE 110,
// Factura Nacional, Pagos y Proformas (Servicios y Materiales).
//
// 2026-11-09: fuentes configurables con prioridad (Configuración → Integraciones,
// codigo TC_CMF / TC_BCENTRAL / TC_MINDICADOR, ver tipo-cambio.fuentes.ts). Se
// consultan en orden de prioridad; si una falla (error, timeout, sin dato) se
// pasa a la siguiente. Respaldo local (tipos_cambio_historico):
//   - fecha ya pasada y guardada → se devuelve sin llamar a nadie;
//   - si fallan todas → último valor guardado con paridad <= fecha (≤ 10 días).
// Sin ninguna fuente configurada se usa mindicador.cl (comportamiento previo).
// Firma pública sin cambios: los callers siguen usando obtenerTipoCambio().
import { logger } from '../../../lib/logger.js'
import * as integracionesRepo from '../../config/integraciones/integraciones.repository.js'
import * as repo from './tipo-cambio.repository.js'
import { FUENTES_TIPO_CAMBIO, type TipoCambioObtenido } from './tipo-cambio.fuentes.js'

export type { TipoCambioObtenido } from './tipo-cambio.fuentes.js'

const ZONA = 'America/Santiago'
function hoySantiagoIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

type Fuente = { codigo: string; url: string | null }

async function fuentesConfiguradas(): Promise<Fuente[]> {
  try {
    const filas = await repo.getFuentesTipoCambio()
    const conocidas = filas.filter((f) => FUENTES_TIPO_CAMBIO[f.codigo])
    if (conocidas.length) return conocidas.map((f) => ({ codigo: f.codigo, url: f.url }))
  } catch (err) {
    // Sin contexto de empresa u otro error al leer la configuración: se cae al default.
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Tipo de cambio: no se pudieron leer las fuentes configuradas')
  }
  return [{ codigo: 'TC_MINDICADOR', url: null }]
}

export async function obtenerTipoCambio(
  monedaCodigo: string,
  // Fecha del documento: paridad de esa fecha o del día hábil anterior más
  // cercano. Sin fecha → valor más reciente publicado.
  fecha?: Date,
): Promise<(TipoCambioObtenido & { fuente: string }) | { error: string }> {
  const moneda = (monedaCodigo ?? '').toUpperCase()
  if (!['USD', 'EUR'].includes(moneda)) {
    return { error: `No hay una fuente automática de tipo de cambio para la moneda ${monedaCodigo}. Ingrésalo manualmente.` }
  }
  // Defensa: una fecha inválida no debe llegar a toISOString() (TCQA-R1-002).
  if (fecha && Number.isNaN(fecha.getTime())) {
    return { error: 'Fecha inválida para consultar el tipo de cambio' }
  }
  const fechaIso = fecha ? fecha.toISOString().slice(0, 10) : null

  // 1) Fecha ya pasada y guardada: la paridad publicada no cambia.
  if (fechaIso && fechaIso < hoySantiagoIso()) {
    try {
      const h = await repo.getHistoricoExacto(moneda, fechaIso)
      if (h) return { valor: Number(h.valor), fecha: h.fechaParidad.toISOString().slice(0, 10), fuente: `${h.fuente} (guardado)` }
    } catch {
      // sin respaldo disponible: se consulta normalmente
    }
  }

  // 2) Fuentes en orden de prioridad.
  const errores: string[] = []
  for (const f of await fuentesConfiguradas()) {
    const def = FUENTES_TIPO_CAMBIO[f.codigo]
    try {
      const r = await def.consultar(moneda, fecha, {
        url: f.url,
        parametro: (id) => integracionesRepo.getValorParametro(f.codigo, id),
      })
      if ('error' in r) {
        errores.push(`${def.nombre}: ${r.error}`)
        continue
      }
      // Se guarda solo si es definitivo: fecha ya pasada, o la paridad es del
      // mismo día pedido. Hoy antes de la publicación la fuente devuelve el día
      // hábil anterior; guardarlo como "hoy" dejaría un valor viejo en el respaldo.
      const definitivo = !fechaIso || fechaIso < hoySantiagoIso() || r.fecha === fechaIso
      try {
        if (definitivo) {
          await repo.guardarHistorico({ monedaCodigo: moneda, fechaConsultaIso: fechaIso ?? r.fecha, fechaParidadIso: r.fecha, valor: r.valor, fuente: f.codigo })
        }
      } catch (err) {
        logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Tipo de cambio: no se pudo guardar el respaldo local')
      }
      return { ...r, fuente: f.codigo }
    } catch (e) {
      errores.push(`${def.nombre}: ${e instanceof Error ? e.message : 'error de red'}`)
    }
  }

  // 3) Último recurso: valor guardado más cercano (<= fecha, ventana 10 días).
  try {
    const h = await repo.getHistoricoCercano(moneda, fechaIso)
    if (h) {
      logger.warn({ moneda, fechaIso, errores }, 'Tipo de cambio: fuentes fallaron, se usa el respaldo local')
      return { valor: Number(h.valor), fecha: h.fechaParidad.toISOString().slice(0, 10), fuente: `${h.fuente} (respaldo)` }
    }
  } catch {
    // sin respaldo
  }
  return { error: `No se pudo obtener el tipo de cambio (${errores.join('; ')}). Ingrésalo manualmente.` }
}
