import { ValidationError } from './errors.js'
import { getTemporadaAsignable, getTemporadaMasReciente, resolverTemporadaPorFecha } from '../modules/config/config.repository.js'

// Temporada de documentos raíz (Cierre, OC fruta, Instructivo de Embalaje,
// Recepción) — 2026-11-06, QA/plan-temporada-listados-nov2026.md.
// 2026-11-09: la temporada es OBLIGATORIA en todo registro (Cierre, OC,
// Instructivo, Recepción, Reclamo, Movimiento de Cuenta Corriente): nunca se
// persiste un documento sin temporada (columna NOT NULL).

export const MENSAJE_SIN_TEMPORADA =
  'No hay temporada activa: selecciona una temporada en el selector general antes de crear el registro'

/** Valida que la temporada exista en la empresa activa y esté vigente (no
 * eliminada ni bloqueada). */
export async function validarTemporadaDocumento(temporadaId: number): Promise<void> {
  const t = await getTemporadaAsignable(temporadaId)
  if (!t) throw new ValidationError('La temporada seleccionada no existe, está bloqueada o fue eliminada')
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

/** Temporada al EDITAR: solo se valida si cambia respecto de la persistida (un
 * documento cuya temporada se bloqueó después puede seguir editándose). `null`
 * explícito no se permite (el documento siempre queda con temporada). */
export async function validarTemporadaEnEdicion(nueva: number | null | undefined, actual: number | null): Promise<void> {
  if (nueva === undefined || nueva === actual) return
  if (nueva === null) throw new ValidationError('La temporada es obligatoria')
  await validarTemporadaDocumento(nueva)
}
