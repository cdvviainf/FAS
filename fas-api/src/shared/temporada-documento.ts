import { ValidationError } from './errors.js'
import { empresaContext } from '../lib/empresa-context.js'
import { getTemporadaAsignable, getTemporadaMasReciente, resolverTemporadaPorFecha } from '../modules/config/config.repository.js'

// Temporada de documentos raíz (Cierre, OC fruta, Instructivo de Embalaje,
// Recepción) — 2026-11-06, QA/plan-temporada-listados-nov2026.md.
// 2026-11-09: la temporada es OBLIGATORIA en todo registro (Cierre, OC,
// Instructivo, Recepción, Reclamo, Movimiento de Cuenta Corriente): nunca se
// persiste un documento sin temporada (columna NOT NULL).

export const MENSAJE_SIN_TEMPORADA =
  'No hay temporada activa: selecciona una temporada en el selector general antes de crear el registro'

export const MENSAJE_SIN_TEMPORADA_LISTADO =
  'No hay temporada activa: selecciona una temporada en el selector general'

/** Valida que la temporada exista en la empresa activa y esté vigente (no
 * eliminada ni bloqueada). */
export async function validarTemporadaDocumento(temporadaId: number): Promise<void> {
  const t = await getTemporadaAsignable(temporadaId)
  if (!t) throw new ValidationError('La temporada seleccionada no existe, está bloqueada o fue eliminada')
}

/** Temporada de un registro que crea el USUARIO sin documento padre
 * (2026-11-16): la del selector superior (cabecera X-Temporada-Id), igual que
 * la empresa. Ningún formulario elige temporada. En un request HTTP sin
 * temporada activa se rechaza. Fuera de HTTP (jobs, scripts, tests) se usa la
 * explícita o, si no viene, la que corresponde por fecha. */
export async function temporadaDelRegistro(fecha: Date, temporadaIdInterno?: number | null): Promise<number> {
  const ctx = empresaContext.getStore()
  if (ctx?.temporadaId != null) {
    await validarTemporadaDocumento(ctx.temporadaId)
    return ctx.temporadaId
  }
  if (ctx?.esHttp) throw new ValidationError(MENSAJE_SIN_TEMPORADA)
  return temporadaParaCrear(temporadaIdInterno, fecha)
}

/** Temporada al CREAR: la enviada (validada) o, si no viene, la que corresponde
 * por fecha (o la predeterminada). */
export async function temporadaParaCrear(temporadaId: number | null | undefined, fecha: Date): Promise<number> {
  if (temporadaId != null) {
    await validarTemporadaDocumento(temporadaId)
    return temporadaId
  }
  const resuelta = await resolverTemporadaPorFecha(fecha)
  if (resuelta == null) throw new ValidationError(MENSAJE_SIN_TEMPORADA)
  return resuelta
}

/** Temporada de un movimiento generado automáticamente (sin usuario que la
 * elija, p. ej. al firmar una Factura): por fecha, predeterminada o, como
 * último respaldo, la temporada más reciente de la empresa. */
export async function temporadaParaMovimientoAutomatico(fecha: Date): Promise<number> {
  const resuelta = (await resolverTemporadaPorFecha(fecha)) ?? (await getTemporadaMasReciente())
  if (resuelta == null) throw new ValidationError('La empresa no tiene temporadas creadas: crea una temporada antes de continuar')
  return resuelta
}

/** La temporada NO se cambia (2026-11-16): queda fija al crear el registro.
 * Las APIs de edición ya no la aceptan; esto protege a los llamadores internos
 * que la reenvíen: igual o ausente → sin cambio; distinta → rechazo. */
export function rechazarCambioTemporada(nueva: number | null | undefined, actual: number | null): void {
  if (nueva === undefined || nueva === actual) return
  throw new ValidationError('La temporada de un registro no se puede cambiar: la fija el selector superior al crearlo')
}

/** Temporada de un LISTADO (2026-11-16, TEC-R1-001 / TEC-R2-002): la del
 * selector superior (cabecera X-Temporada-Id) manda y un `?temporadaId=`
 * distinto se ignora. Un request HTTP SIN temporada activa se rechaza (nunca
 * se listan todas las temporadas). El parámetro solo aplica fuera de HTTP
 * (jobs, scripts, tests). */
export function temporadaDelListado(temporadaIdQuery?: number | null): number | undefined {
  const ctx = empresaContext.getStore()
  if (ctx?.temporadaId != null) return ctx.temporadaId
  if (ctx?.esHttp) throw new ValidationError(MENSAJE_SIN_TEMPORADA_LISTADO)
  return temporadaIdQuery ?? undefined
}

/** Filtro de listados por la temporada activa (ver `temporadaDelListado`):
 * `{ temporadaId }` o `{}` si no hay ninguna. Se esparce en el `where` de
 * Prisma de cada listado season-scoped. */
export function filtroTemporadaActiva(temporadaIdQuery?: number | null): { temporadaId?: number } {
  const temporadaId = temporadaDelListado(temporadaIdQuery)
  return temporadaId != null ? { temporadaId } : {}
}
