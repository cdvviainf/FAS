import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './contratos.repository.js'
import { findEntidadById } from '../../config/entidades/entidades.repository.js'
import type { ContratoCreateInput, ContratoUpdateInput } from './contratos.types.js'

async function validarProductor(entidadId: number) {
  const entidad = await findEntidadById(entidadId)
  if (!entidad) throw new NotFoundError('Entidad', String(entidadId))
  if (!entidad.tipos.includes('PRODUCTOR')) {
    throw new ValidationError('La entidad seleccionada no es de tipo Productor')
  }
}

export async function listarContratos(entidadId: number) {
  await validarProductor(entidadId)
  return repo.listContratosPorEntidad(entidadId)
}

export async function obtenerContrato(entidadId: number, contratoId: number) {
  const contrato = await repo.getContratoById(entidadId, contratoId)
  if (!contrato) throw new NotFoundError('Contrato', String(contratoId))
  return contrato
}

// PROD-03: la temporada debe existir, no estar eliminada ni bloqueada
async function validarReferenciasVigentes(body: ContratoCreateInput | ContratoUpdateInput) {
  if (body.temporadaId != null) {
    const temporada = await repo.getTemporadaActiva(body.temporadaId)
    if (!temporada) throw new ValidationError('La temporada seleccionada no existe, está bloqueada o fue eliminada')
  }
}

// R3: bloquear la creación de contrato si el productor no tiene representante legal
export async function crearContrato(entidadId: number, body: ContratoCreateInput, userId: string) {
  await validarProductor(entidadId)
  const tieneRepLegal = await repo.tieneRepresentanteLegal(entidadId)
  if (!tieneRepLegal) {
    throw new ValidationError(
      'El productor debe tener un representante legal (con RUT) registrado antes de crear un contrato (R3)',
    )
  }
  await validarReferenciasVigentes(body)
  return repo.createContrato(entidadId, body, userId)
}

export async function actualizarContrato(entidadId: number, contratoId: number, body: ContratoUpdateInput, userId: string) {
  await obtenerContrato(entidadId, contratoId)
  await validarReferenciasVigentes(body)
  return repo.updateContrato(contratoId, body, userId)
}

export async function eliminarContrato(entidadId: number, contratoId: number, userId: string) {
  await obtenerContrato(entidadId, contratoId)
  await repo.softDeleteContrato(contratoId, userId)
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

const MIME_PDF = 'application/pdf'
export const MAX_PDF_BYTES = 15 * 1024 * 1024

export async function subirPdf(
  entidadId: number,
  contratoId: number,
  archivo: { nombre: string; mime: string; datos: Buffer },
) {
  await obtenerContrato(entidadId, contratoId)
  if (archivo.mime !== MIME_PDF) {
    throw new ValidationError('Solo se acepta PDF para el contrato')
  }
  if (archivo.datos.length > MAX_PDF_BYTES) {
    throw new ValidationError('El PDF supera el tamaño máximo de 15 MB')
  }
  return repo.guardarPdf(
    contratoId,
    { nombre: archivo.nombre, mime: archivo.mime, tamano: archivo.datos.length },
    archivo.datos,
  )
}

export async function descargarPdf(entidadId: number, contratoId: number) {
  const contrato = await obtenerContrato(entidadId, contratoId)
  if (!contrato.pdfNombre) throw new NotFoundError('PDF del contrato', String(contratoId))
  const contenido = await repo.getPdfContenido(contratoId)
  if (!contenido) throw new NotFoundError('Contenido del PDF', String(contratoId))
  return { meta: { nombre: contrato.pdfNombre, mime: contrato.pdfMime! }, datos: Buffer.from(contenido.datos) }
}
