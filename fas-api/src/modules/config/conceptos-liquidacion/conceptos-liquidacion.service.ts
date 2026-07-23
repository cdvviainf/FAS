import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './conceptos-liquidacion.repository.js'
import type { ConceptoLiquidacionCreateInput, ConceptoLiquidacionUpdateInput } from './conceptos-liquidacion.types.js'

export async function listarConceptos() {
  return repo.listConceptos()
}

export async function obtenerConcepto(id: number) {
  const concepto = await repo.getConceptoById(id)
  if (!concepto) throw new NotFoundError('Concepto de liquidación', String(id))
  return concepto
}

export async function crearConcepto(body: ConceptoLiquidacionCreateInput, userId: string) {
  const existente = await repo.findConceptoByCodigo(body.codigo)
  if (existente) throw new ValidationError(`Ya existe un concepto de liquidación con código "${body.codigo}"`)
  return repo.createConcepto(body, userId)
}

export async function actualizarConcepto(id: number, body: ConceptoLiquidacionUpdateInput, userId: string) {
  await obtenerConcepto(id)
  return repo.updateConcepto(id, body, userId)
}

export async function eliminarConcepto(id: number, userId: string) {
  await obtenerConcepto(id)
  await repo.softDeleteConcepto(id, userId)
}
