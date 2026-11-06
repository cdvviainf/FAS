import { ValidationError } from './errors.js'
import { getTemporadaAsignable, resolverTemporadaPorFecha } from '../modules/config/config.repository.js'

// Temporada de documentos raíz (Cierre, OC fruta, Instructivo de Embalaje,
// Recepción) — 2026-11-06, QA/plan-temporada-listados-nov2026.md.

/** Valida que la temporada exista en la empresa activa y esté vigente (no
 * eliminada ni bloqueada). */
export async function validarTemporadaDocumento(temporadaId: number): Promise<void> {
  const t = await getTemporadaAsignable(temporadaId)
  if (!t) throw new ValidationError('La temporada seleccionada no existe, está bloqueada o fue eliminada')
}

/** Temporada al CREAR: la enviada (validada) o, si no viene, la que corresponde
 * por fecha (o la predeterminada). */
export async function temporadaParaCrear(temporadaId: number | null | undefined, fecha: Date): Promise<number | null> {
  if (temporadaId != null) {
    await validarTemporadaDocumento(temporadaId)
    return temporadaId
  }
  return resolverTemporadaPorFecha(fecha)
}

/** Temporada al EDITAR: solo se valida si cambia respecto de la persistida (un
 * documento cuya temporada se bloqueó después puede seguir editándose). `null`
 * explícito no se permite (el documento siempre queda con temporada). */
export async function validarTemporadaEnEdicion(nueva: number | null | undefined, actual: number | null): Promise<void> {
  if (nueva === undefined || nueva === actual) return
  if (nueva === null) throw new ValidationError('La temporada es obligatoria')
  await validarTemporadaDocumento(nueva)
}
