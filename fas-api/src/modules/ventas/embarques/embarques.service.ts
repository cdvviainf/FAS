import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors.js'
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

// ─── Seleccionar Pallets (ventas.md R8/R9) ──────────────────────────────────
//
// Deuda aceptada explícitamente (decisión de negocio, Christian, 2026-09-02
// — QA ronda 3, EP-QA-003/EP-QA-004, ambos persisten a propósito, no son
// bugs de esta entrega):
//   - EP-QA-003: confirmarDespacho() no exige reconciliación contra Packing
//     List (compras.md §9.3) — ese módulo no existe todavía en el sistema.
//   - EP-QA-004: reservar pallets no genera InstructivoHijo por punto de
//     retiro (ventas.md R11) — ese modelo tampoco existe; la pestaña
//     "Generar Instructivos" sigue como placeholder a propósito.
// Ninguno de los dos bloquea lo construido en esta entrega (Seleccionar
// Pallets + Despachar mínimo); quedan para cuando se aborden esos módulos.

// Pallets sin reservar que calzan con el detalle de la NV de este Embarque —
// candidatos para el paso "Seleccionar Pallets" (solo catálogo, sin tope de
// cantidad — decisión de negocio, Christian, 2026-09-02).
export async function listarPalletsDisponibles(embarqueId: number) {
  const embarque = await obtenerEmbarque(embarqueId)
  const notaVenta = await repo.getNotaVentaConDetalle(embarque.notaVentaId)
  if (!notaVenta) throw new ValidationError('El Cierre Comercial de este Embarque ya no existe')
  return repo.getPalletsDisponibles(notaVenta.detalles)
}

// Reclamo atómico en el repositorio (reservarPalletsEnEmbarque) es la
// defensa real contra dos Embarques reservando el mismo pallet a la vez; acá
// solo se valida existencia del Embarque y que las líneas calcen con el
// detalle de la NV (pre-check, mismo criterio que el motor de Recepción).
// Agregar pallets se permite incluso con el Embarque ya despachado
// (decisión de negocio, Christian) — solo desvincular queda bloqueado.
export async function agregarPallets(embarqueId: number, palletIds: number[]) {
  const embarque = await obtenerEmbarque(embarqueId)
  const unicos = Array.from(new Set(palletIds))
  const notaVenta = await repo.getNotaVentaConDetalle(embarque.notaVentaId)
  if (!notaVenta) throw new ValidationError('El Cierre Comercial de este Embarque ya no existe')

  const disponibles = await repo.getPalletsDisponibles(notaVenta.detalles)
  const disponiblesIds = new Set(disponibles.map((p) => p.id))
  const fueraDeAlcance = unicos.filter((id) => !disponiblesIds.has(id))
  if (fueraDeAlcance.length > 0) {
    throw new ValidationError(
      `Uno o más pallets no están disponibles o no calzan con el detalle de este Cierre Comercial: ${fueraDeAlcance.join(', ')}`,
    )
  }

  await repo.reservarPalletsEnEmbarque(unicos, embarqueId)
  return repo.getEmbarqueById(embarqueId)
}

export async function quitarPallet(embarqueId: number, palletId: number) {
  const resultado = await repo.desvincularPallet(embarqueId, palletId)
  if (resultado === 'NO_ENCONTRADO') {
    await obtenerEmbarque(embarqueId) // 404 si el Embarque ya no existe
    throw new NotFoundError('Pallet reservado a este Embarque', String(palletId))
  }
  if (resultado === 'DESPACHADO') {
    throw new ConflictError('No se puede desvincular un pallet de un Embarque ya despachado')
  }
  return repo.getEmbarqueById(embarqueId)
}

// ─── Despachar ───────────────────────────────────────────────────────────────

export async function confirmarDespacho(embarqueId: number, userId: string) {
  const resultado = await repo.confirmarDespacho(embarqueId, userId)
  if (resultado === 'NO_ENCONTRADO') throw new NotFoundError('Embarque', String(embarqueId))
  if (resultado === 'YA_DESPACHADO') throw new ConflictError('Este Embarque ya fue despachado')
  if (resultado === 'SIN_PALLETS') throw new ValidationError('No se puede despachar un Embarque sin pallets reservados')
  return resultado
}
