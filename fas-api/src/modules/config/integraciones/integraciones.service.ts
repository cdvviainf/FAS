import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import { decrypt, encrypt } from '../../../lib/crypto.js'
import * as repo from './integraciones.repository.js'
import type {
  IntegracionCreateInput,
  IntegracionUpdateInput,
  IntegracionParametroInput,
  IntegracionParametroUpdateInput,
  IntegracionListFilters,
  MaestroIntegracion,
} from './integraciones.types.js'

export async function listarIntegraciones(filters: IntegracionListFilters) {
  const { page = 1, limit = 20 } = filters
  const { data, total } = await repo.listIntegraciones(page, limit)
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function obtenerIntegracion(id: number) {
  const integracion = await repo.getIntegracionById(id)
  if (!integracion) throw new NotFoundError('Integración', String(id))
  return integracion
}

export async function crearIntegracion(body: IntegracionCreateInput, creadoPor: string) {
  const existente = await repo.findIntegracionByCodigo(body.codigo)
  if (existente) throw new ValidationError(`Ya existe una Integración con código "${body.codigo}"`)
  return repo.createIntegracion(body, creadoPor)
}

export async function actualizarIntegracion(id: number, body: IntegracionUpdateInput, actualizadoPor: string) {
  await obtenerIntegracion(id)
  return repo.updateIntegracion(id, body, actualizadoPor)
}

export async function eliminarIntegracion(id: number, eliminadoPor: string) {
  await obtenerIntegracion(id)
  await repo.softDeleteIntegracion(id, eliminadoPor)
}

export async function agregarParametro(integracionId: number, body: IntegracionParametroInput) {
  await obtenerIntegracion(integracionId)
  return repo.addParametro(integracionId, body)
}

// El valor enmascarado nunca llega de vuelta en un PATCH real (el frontend
// solo reenvía `valorExterno` cuando el usuario lo cambió) — si viene
// `undefined`, se conserva el valor real actual, re-cifrándolo si `sensible`
// pasó de false a true (o descifrándolo si pasó de true a false).
export async function actualizarParametro(integracionId: number, parametroId: number, body: IntegracionParametroUpdateInput) {
  await obtenerIntegracion(integracionId)
  const actual = await repo.getParametroCrudoById(parametroId)
  if (!actual || actual.integracionId !== integracionId) {
    throw new NotFoundError('Parámetro de Integración', String(parametroId))
  }

  const tipoFinal = body.tipo ?? actual.tipo
  const sensibleFinal = body.sensible ?? actual.sensible

  let valorRealFinal: string
  if (body.valorExterno !== undefined) {
    valorRealFinal = body.valorExterno
  } else {
    valorRealFinal = actual.sensible ? decrypt(actual.valorExterno) : actual.valorExterno
  }
  const valorExternoAGuardar = sensibleFinal ? encrypt(valorRealFinal) : valorRealFinal

  return repo.updateParametroResuelto(parametroId, {
    idExterno: body.idExterno ?? actual.idExterno,
    tipo: tipoFinal,
    maestro: tipoFinal === 'MAESTRO' ? (body.maestro ?? actual.maestro) : null,
    maestroId: tipoFinal === 'MAESTRO' ? (body.maestroId ?? actual.maestroId ?? undefined) : null,
    valorLocal: tipoFinal === 'MAESTRO' ? (body.valorLocal ?? actual.valorLocal) : '',
    valorExternoAGuardar,
    sensible: sensibleFinal,
    descripcion: body.descripcion !== undefined ? body.descripcion : actual.descripcion,
  })
}

export async function eliminarParametro(integracionId: number, parametroId: number) {
  await obtenerIntegracion(integracionId)
  const actual = await repo.getParametroCrudoById(parametroId)
  if (!actual || actual.integracionId !== integracionId) {
    throw new NotFoundError('Parámetro de Integración', String(parametroId))
  }
  await repo.removeParametro(parametroId)
}

export async function listarOpcionesMaestro(maestro: MaestroIntegracion) {
  return repo.listOpcionesMaestro(maestro)
}
