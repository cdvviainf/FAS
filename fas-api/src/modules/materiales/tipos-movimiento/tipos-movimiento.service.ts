import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './tipos-movimiento.repository.js'
import { CODIGO_TIPO_REVERSO_RECEPCION } from '../movimientos/movimientos.repository.js'
import type { TipoMovimientoCreateInput, TipoMovimientoUpdateInput, TipoMovimientoListFilters } from './tipos-movimiento.types.js'

export async function listarTiposMovimiento(filters: TipoMovimientoListFilters) {
  const { data, total } = await repo.listTiposMovimiento(filters)
  const { page = 1, limit = 20 } = filters
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function obtenerTipoMovimiento(id: number) {
  const tipo = await repo.getTipoMovimientoById(id)
  if (!tipo) throw new NotFoundError('Tipo de movimiento', String(id))
  return tipo
}

// MAT-R24-003 (QA ronda 2): REVERSO_RECEPCION_OC es un registro de sistema
// (materiales.md R24) que "Anular recepción" crea y mantiene por su cuenta —
// no se puede crear a mano con una configuración distinta (ej. clase
// ENTRADA) ni editar después (desactivarlo, cambiarle la clase/módulos).
function assertNoEsCodigoReservado(codigo: string) {
  if (codigo === CODIGO_TIPO_REVERSO_RECEPCION) {
    throw new ValidationError(`El código "${CODIGO_TIPO_REVERSO_RECEPCION}" está reservado para el sistema (Anular recepción, R24) y no puede crearse ni editarse manualmente`)
  }
}

// R25: generaProforma marca este tipo como origen elegible para una Proforma
// de Venta de Materiales — solo tiene sentido en movimientos que sacan stock.
function validarGeneraProforma(clase: string, generaProforma: boolean | undefined) {
  if (generaProforma && clase !== 'SALIDA') {
    throw new ValidationError('Solo un Tipo de Movimiento clase Salida puede marcarse para generar Proforma de Venta (R25)')
  }
}

export async function crearTipoMovimiento(body: TipoMovimientoCreateInput) {
  assertNoEsCodigoReservado(body.codigo)
  validarGeneraProforma(body.clase, body.generaProforma)
  const existente = await repo.findTipoMovimientoByCodigo(body.codigo)
  if (existente) throw new ValidationError(`Ya existe un tipo de movimiento con código "${body.codigo}"`)
  return repo.createTipoMovimiento(body)
}

export async function actualizarTipoMovimiento(id: number, body: TipoMovimientoUpdateInput) {
  const actual = await obtenerTipoMovimiento(id)
  assertNoEsCodigoReservado(actual.codigo)
  const claseFinal = body.clase ?? actual.clase
  const generaProformaFinal = body.generaProforma ?? actual.generaProforma
  validarGeneraProforma(claseFinal, generaProformaFinal)
  return repo.updateTipoMovimiento(id, body)
}
