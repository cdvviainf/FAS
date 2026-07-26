import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './condiciones-pago.repository.js'
import type { CondicionPagoCreateInput, CondicionPagoUpdateInput } from './condiciones-pago.types.js'

export async function listarCondicionesPago(q?: string) {
  return repo.listCondicionesPago(q)
}

export async function obtenerCondicionPago(id: number) {
  const condicionPago = await repo.getCondicionPagoById(id)
  if (!condicionPago) throw new NotFoundError('Condición de Pago', String(id))
  return condicionPago
}

export async function crearCondicionPago(body: CondicionPagoCreateInput, userId: string) {
  const existente = await repo.findCondicionPagoByCodigo(body.codigo)
  if (existente) throw new ValidationError(`Ya existe una Condición de Pago con código "${body.codigo}"`)
  return repo.createCondicionPago(body, userId)
}

export async function actualizarCondicionPago(id: number, body: CondicionPagoUpdateInput, userId: string) {
  await obtenerCondicionPago(id)
  return repo.updateCondicionPago(id, body, userId)
}

export async function eliminarCondicionPago(id: number, userId: string) {
  await obtenerCondicionPago(id)
  await repo.softDeleteCondicionPago(id, userId)
}
