import { Prisma } from '@prisma/client'
import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './prefijos-codigo.repository.js'
import type { PrefijoCodigoCreateInput, PrefijoCodigoUpdateInput } from './prefijos-codigo.types.js'

export async function listarPrefijosCodigo() {
  return repo.listPrefijosCodigo()
}

export async function obtenerPrefijoCodigo(id: number) {
  const prefijo = await repo.getPrefijoCodigoById(id)
  if (!prefijo) throw new NotFoundError('Prefijo de Código', String(id))
  return prefijo
}

export async function crearPrefijoCodigo(body: PrefijoCodigoCreateInput, userId: string) {
  const existente = await repo.findPrefijoCodigoByModelo(body.modelo, body.tipoEmbarqueId)
  if (existente) throw new ValidationError(`Ya existe un prefijo configurado para "${body.modelo}"`)
  try {
    return await repo.createPrefijoCodigo(body, userId)
  } catch (err) {
    // El check-then-create de arriba no es atómico: si dos solicitudes
    // concurrentes pasan la validación a la vez, el índice único parcial de
    // BD (WHERE eliminadoEn IS NULL) rechaza la segunda inserción — se
    // traduce a un error de negocio en vez de un 500 crudo.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ValidationError(`Ya existe un prefijo configurado para "${body.modelo}"`)
    }
    throw err
  }
}

export async function actualizarPrefijoCodigo(id: number, body: PrefijoCodigoUpdateInput, userId: string) {
  await obtenerPrefijoCodigo(id)
  return repo.updatePrefijoCodigo(id, body, userId)
}

export async function eliminarPrefijoCodigo(id: number, userId: string) {
  await obtenerPrefijoCodigo(id)
  await repo.softDeletePrefijoCodigo(id, userId)
}

// Retorna null si el mantenedor no tiene prefijo configurado — el frontend
// deja el campo código vacío para completar a mano, como hasta ahora.
export async function siguienteCodigo(modelo: string) {
  const prefijo = await repo.findPrefijoCodigoByModelo(modelo)
  if (!prefijo) return null
  return repo.calcularSiguienteCodigo(modelo, prefijo.prefijo, prefijo.digitos)
}

// Prefijo configurado para un Tipo de Embarque — usado por embarques.service.ts
// para generar `numeroInstructivo` a partir del folio de la NV (ventas.md R10).
// null si no hay prefijo configurado para ese tipo.
export async function obtenerPrefijoEmbarque(tipoEmbarqueId: number) {
  return repo.findPrefijoCodigoByModelo('embarque', tipoEmbarqueId)
}

// {prefijo}{numero, con padding a `digitos`} — mismo formato que
// calcularSiguienteCodigo, pero a partir de un número ya conocido (el folio
// de la NV) en vez de calcular un correlativo nuevo.
export function formatearConPrefijo(prefijo: string, digitos: number, numero: number): string {
  return `${prefijo}${String(numero).padStart(digitos, '0')}`
}
