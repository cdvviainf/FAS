import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './tipos-movimiento.repository.js'
import type { TipoMovimientoCreateInput, TipoMovimientoUpdateInput, TipoMovimientoListFilters } from './tipos-movimiento.types.js'

export async function listarTiposMovimiento(filters: TipoMovimientoListFilters) {
  const { data, total } = await repo.listTiposMovimiento(filters)
  const { page = 1, limit = 20 } = filters
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function obtenerTipoMovimiento(id: number) {
  const tipo = await repo.getTipoMovimientoById(id)
  if (!tipo) throw new NotFoundError('Tipo de movimiento', String(id))
  return tipo
}

export async function crearTipoMovimiento(body: TipoMovimientoCreateInput) {
  const existente = await repo.findTipoMovimientoByCodigo(body.codigo)
  if (existente) throw new ValidationError(`Ya existe un tipo de movimiento con código "${body.codigo}"`)
  return repo.createTipoMovimiento(body)
}

export async function actualizarTipoMovimiento(id: number, body: TipoMovimientoUpdateInput) {
  await obtenerTipoMovimiento(id)
  return repo.updateTipoMovimiento(id, body)
}
