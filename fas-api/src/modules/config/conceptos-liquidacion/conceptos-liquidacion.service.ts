import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './conceptos-liquidacion.repository.js'
import type { ConceptoLiquidacionCreateInput, ConceptoLiquidacionUpdateInput, ValorEspecieInput } from './conceptos-liquidacion.types.js'

// Especie es por-empresa desde Fase 3 (lote Config/Mantenedores) — sin esta
// validación, un concepto podía referenciar una especie de otra empresa por
// ID (FAS-EMP-F3-PROD-R1-001).
async function validarEspecies(valores: ValorEspecieInput[]) {
  if (valores.length === 0) return
  const ids = [...new Set(valores.map((v) => v.especieId))]
  const especies = await repo.getEspeciesPorIds(ids)
  if (especies.length !== ids.length) {
    throw new ValidationError('Una o más especies seleccionadas no existen o fueron eliminadas')
  }
}

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
  await validarEspecies(body.valores)
  return repo.createConcepto(body, userId)
}

export async function actualizarConcepto(id: number, body: ConceptoLiquidacionUpdateInput, userId: string) {
  await obtenerConcepto(id)
  if (body.valores !== undefined) {
    await validarEspecies(body.valores)
  }
  return repo.updateConcepto(id, body, userId)
}

export async function eliminarConcepto(id: number, userId: string) {
  await obtenerConcepto(id)
  await repo.softDeleteConcepto(id, userId)
}
