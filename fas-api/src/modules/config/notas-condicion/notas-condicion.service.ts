import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './notas-condicion.repository.js'
import type { NotaCondicionCreateInput, NotaCondicionUpdateInput } from './notas-condicion.types.js'

async function validarEspecies(especieIds: number[]) {
  if (especieIds.length === 0) return
  const ids = [...new Set(especieIds)]
  const especies = await repo.getEspeciesPorIds(ids)
  if (especies.length !== ids.length) {
    throw new ValidationError('Una o más especies seleccionadas no existen o fueron eliminadas')
  }
}

export async function listarNotasCondicion() {
  return repo.listNotasCondicion()
}

export async function obtenerNotaCondicion(id: number) {
  const nota = await repo.getNotaCondicionById(id)
  if (!nota) throw new NotFoundError('Nota de Condición', String(id))
  return nota
}

export async function crearNotaCondicion(body: NotaCondicionCreateInput, userId: string) {
  const existente = await repo.findNotaCondicionByCodigo(body.codigo)
  if (existente) throw new ValidationError(`Ya existe una Nota de Condición con código "${body.codigo}"`)
  await validarEspecies(body.especieIds)
  return repo.createNotaCondicion(body, userId)
}

export async function actualizarNotaCondicion(id: number, body: NotaCondicionUpdateInput, userId: string) {
  await obtenerNotaCondicion(id)
  if (body.especieIds !== undefined) {
    await validarEspecies(body.especieIds)
  }
  return repo.updateNotaCondicion(id, body, userId)
}

export async function eliminarNotaCondicion(id: number, userId: string) {
  await obtenerNotaCondicion(id)
  await repo.softDeleteNotaCondicion(id, userId)
}
