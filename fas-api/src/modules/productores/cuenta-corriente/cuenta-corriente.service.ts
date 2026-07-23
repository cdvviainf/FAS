import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './cuenta-corriente.repository.js'
import { findEntidadById } from '../../config/entidades/entidades.repository.js'
import type { MovimientoCCCreateInput, CuentaCorrienteFilters } from './cuenta-corriente.types.js'

async function validarProductor(entidadId: number) {
  const entidad = await findEntidadById(entidadId)
  if (!entidad) throw new NotFoundError('Entidad', String(entidadId))
  if (!entidad.tipos.includes('PRODUCTOR')) {
    throw new ValidationError('La entidad seleccionada no es de tipo Productor')
  }
}

export async function obtenerInforme(entidadId: number, filters: CuentaCorrienteFilters) {
  await validarProductor(entidadId)
  const [movimientos, saldo] = await Promise.all([
    repo.listMovimientos(entidadId, filters),
    repo.calcularSaldo(entidadId),
  ])
  return { movimientos, saldo }
}

export async function imputarMovimiento(entidadId: number, body: MovimientoCCCreateInput, usuarioId: string) {
  await validarProductor(entidadId)

  const tipo = await repo.getTipoCtaCteActivo(body.tipoId)
  if (!tipo) throw new ValidationError('El concepto de cuenta corriente no existe, está bloqueado o fue eliminado')

  // R6: la naturaleza del movimiento debe ser compatible con la naturaleza del tipo
  if (tipo.naturaleza !== 'AMBOS' && tipo.naturaleza !== body.naturaleza) {
    throw new ValidationError(
      `El concepto "${tipo.descripcion}" solo admite movimientos de naturaleza ${tipo.naturaleza} (R6)`,
    )
  }

  // PROD-03: moneda y temporada, si se informan, deben estar vigentes
  if (body.monedaId != null) {
    const moneda = await repo.getMonedaActiva(body.monedaId)
    if (!moneda) throw new ValidationError('La moneda seleccionada no existe, está bloqueada o fue eliminada')
  }
  if (body.temporadaId != null) {
    const temporada = await repo.getTemporadaActiva(body.temporadaId)
    if (!temporada) throw new ValidationError('La temporada seleccionada no existe, está bloqueada o fue eliminada')
  }

  return repo.createMovimiento(entidadId, body, usuarioId)
}
