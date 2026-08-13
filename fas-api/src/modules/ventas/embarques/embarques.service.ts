import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './embarques.repository.js'
import * as prefijosService from '../../config/prefijos-codigo/prefijos-codigo.service.js'
import type { EmbarqueCreateInput } from './embarques.types.js'

export async function listarEmbarques(page: number, limit: number, notaVentaId?: number) {
  const { data, total } = await repo.listEmbarques(page, limit, notaVentaId)
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function obtenerEmbarque(id: number) {
  const embarque = await repo.getEmbarqueById(id)
  if (!embarque) throw new NotFoundError('Embarque', String(id))
  return embarque
}

// numeroInstructivo ya no se ingresa manualmente (2026-08-13, ventas.md R10
// — supersesión): se calcula como {prefijo del Tipo de Embarque}{folio de la
// NV, con el padding de dígitos configurado en Configuración → Prefijos}.
export async function generarEmbarque(body: EmbarqueCreateInput, creadoPor: string) {
  const notaVenta = await repo.getNotaVenta(body.notaVentaId)
  if (!notaVenta) throw new ValidationError('El Cierre Comercial seleccionado no existe')

  const prefijoConfig = await prefijosService.obtenerPrefijoEmbarque(notaVenta.tipoEmbarqueId)
  if (!prefijoConfig) {
    throw new ValidationError(
      'No hay un prefijo configurado para el Tipo de Embarque de este Cierre Comercial. Configúralo en Configuración → Prefijos antes de generar el Embarque.',
    )
  }
  const numeroInstructivo = prefijosService.formatearConPrefijo(prefijoConfig.prefijo, prefijoConfig.digitos, notaVenta.folio)

  // Una NV puede generar más de un Embarque (R7) — con este esquema, el
  // segundo chocaría con el número del primero (mismo folio, mismo tipo de
  // embarque). Queda pendiente resolver la desambiguación (decisión de
  // negocio diferida); por ahora se rechaza con un error claro en vez de
  // fallar con un 500 de restricción única.
  const existente = await repo.findByNumeroInstructivo(numeroInstructivo)
  if (existente) {
    throw new ValidationError(
      `Ya existe un Embarque con el número "${numeroInstructivo}" — probablemente ya se generó un Embarque para este Cierre Comercial.`,
    )
  }

  return repo.createEmbarque(body.notaVentaId, numeroInstructivo, creadoPor)
}
