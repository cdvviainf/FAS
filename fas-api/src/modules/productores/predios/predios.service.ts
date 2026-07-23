import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './predios.repository.js'
import { findEntidadById } from '../../config/entidades/entidades.repository.js'
import type { PredioCreateInput, PredioUpdateInput } from './predios.types.js'

// R1: la entidad debe existir y ser de tipo PRODUCTOR
async function validarProductor(entidadId: number) {
  const entidad = await findEntidadById(entidadId)
  if (!entidad) throw new NotFoundError('Entidad', String(entidadId))
  if (!entidad.tipos.includes('PRODUCTOR')) {
    throw new ValidationError('La entidad seleccionada no es de tipo Productor (R1)')
  }
  return entidad
}

export async function listarPredios(entidadId: number) {
  await validarProductor(entidadId)
  return repo.listPrediosPorEntidad(entidadId)
}

export async function obtenerPredio(entidadId: number, predioId: number) {
  const predio = await repo.getPredioById(entidadId, predioId)
  if (!predio) throw new NotFoundError('Predio', String(predioId))
  return predio
}

// PROD-03: comuna/tipoProduccion/zona deben existir, no estar eliminados ni bloqueados
async function validarReferenciasVigentes(body: PredioCreateInput | PredioUpdateInput) {
  if (body.comunaId != null) {
    const comuna = await repo.getComunaActiva(body.comunaId)
    if (!comuna) throw new ValidationError('La comuna seleccionada no existe, está bloqueada o fue eliminada')
  }
  if (body.tipoProduccionId != null) {
    const tipoProduccion = await repo.getTipoProduccionActivo(body.tipoProduccionId)
    if (!tipoProduccion) throw new ValidationError('El tipo de producción seleccionado no existe, está bloqueado o fue eliminado')
  }
  if (body.zonaId != null) {
    const zona = await repo.getZonaActiva(body.zonaId)
    if (!zona) throw new ValidationError('La zona seleccionada no existe, está bloqueada o fue eliminada')
  }
}

export async function crearPredio(entidadId: number, body: PredioCreateInput, userId: string) {
  await validarProductor(entidadId)

  // R2: código único por productor entre no eliminados
  const existente = await repo.findPredioByCodigo(entidadId, body.codigo)
  if (existente) throw new ValidationError(`Ya existe un predio con código "${body.codigo}" para este productor`)

  await validarReferenciasVigentes(body)

  return repo.createPredio(entidadId, body, userId)
}

export async function actualizarPredio(entidadId: number, predioId: number, body: PredioUpdateInput, userId: string) {
  await obtenerPredio(entidadId, predioId)
  await validarReferenciasVigentes(body)
  return repo.updatePredio(predioId, body, userId)
}

export async function eliminarPredio(entidadId: number, predioId: number, userId: string) {
  await obtenerPredio(entidadId, predioId)
  await repo.softDeletePredio(predioId, userId)
}
