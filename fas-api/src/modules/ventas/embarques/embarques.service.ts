import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './embarques.repository.js'
import type { EmbarqueCreateInput } from './embarques.types.js'

export async function listarEmbarques(notaVentaId?: number) {
  return repo.listEmbarques(notaVentaId)
}

export async function obtenerEmbarque(id: number) {
  const embarque = await repo.getEmbarqueById(id)
  if (!embarque) throw new NotFoundError('Embarque', String(id))
  return embarque
}

export async function generarEmbarque(body: EmbarqueCreateInput, creadoPor: string) {
  const notaVenta = await repo.getNotaVenta(body.notaVentaId)
  if (!notaVenta) throw new ValidationError('El Cierre Comercial seleccionado no existe')

  const existente = await repo.findByNumeroInstructivo(body.numeroInstructivo)
  if (existente) throw new ValidationError(`Ya existe un Embarque con el número de instructivo "${body.numeroInstructivo}"`)

  return repo.createEmbarque(body, creadoPor)
}
