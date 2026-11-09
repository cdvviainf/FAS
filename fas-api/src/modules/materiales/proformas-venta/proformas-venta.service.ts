import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import { obtenerTipoCambio } from '../../finanzas/facturacion/tipo-cambio.adapter.js'
import * as repo from './proformas-venta.repository.js'
import type {
  ProformaMaterialCreateInput,
  ProformaMaterialUpdateInput,
  ProformaMaterialLineaUpdateInput,
  ProformaMaterialListFilters,
} from './proformas-venta.types.js'

async function validarReferenciasHeader(data: {
  monedaId?: number
  formaPagoId?: number | null
  condicionPagoId?: number | null
}) {
  if (data.monedaId != null) {
    const moneda = await repo.getMoneda(data.monedaId)
    if (!moneda) throw new ValidationError('La moneda seleccionada no existe o está bloqueada')
  }
  if (data.formaPagoId != null) {
    const formaPago = await repo.getFormaPago(data.formaPagoId)
    if (!formaPago) throw new ValidationError('La forma de pago seleccionada no existe o está bloqueada')
  }
  if (data.condicionPagoId != null) {
    const condicionPago = await repo.getCondicionPago(data.condicionPagoId)
    if (!condicionPago) throw new ValidationError('La condición de pago seleccionada no existe o está bloqueada')
    if (condicionPago.tipo !== 'VENTA') {
      throw new ValidationError('La condición de pago debe ser de tipo Venta')
    }
    // R25 (cuota MONTO_UNITARIO no permitida) se revalida bajo lock en el
    // repositorio al construir el snapshot — acá solo el pre-check de
    // existencia/tipo, más rápido de mostrar en el formulario.
  }
}

export async function listarProformasMaterial(filters: ProformaMaterialListFilters) {
  const { page = 1, limit = 20, entidadId, estado } = filters
  const { data, total } = await repo.listProformasMaterial(page, limit, entidadId, estado)
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

// Landing movimiento-céntrico: Movimientos que requieren proforma + estado de su
// proforma (Pendiente / estado de la proforma activa).
export async function listarMovimientosRequierenProforma(filters: { page?: number; limit?: number }) {
  const { page = 1, limit = 20 } = filters
  const { data, total } = await repo.listMovimientosRequierenProforma(page, limit)
  const filas = data.map(({ proformasMaterial, ...mov }) => ({
    ...mov,
    proforma: proformasMaterial[0] ?? null,
  }))
  return { data: filas, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function obtenerProformaMaterial(id: number) {
  const proforma = await repo.getProformaMaterialById(id)
  if (!proforma) throw new NotFoundError('Proforma de Venta de Materiales', String(id))
  return proforma
}

// Tipo de cambio sugerido (botón "Obtener", 2026-11-09) — mismo criterio que la
// Proforma de Servicios: CLP = 1; otra moneda = fuentes configuradas (TC_*).
export async function obtenerTipoCambioSugerido(monedaCodigo: string, fecha?: string) {
  if (monedaCodigo.toUpperCase() === 'CLP') return { valor: 1, fecha: null, moneda: 'CLP', fuente: null }
  const tc = await obtenerTipoCambio(monedaCodigo, fecha ? new Date(fecha) : undefined)
  if ('error' in tc) throw new ValidationError(tc.error)
  return { valor: tc.valor, fecha: tc.fecha, moneda: monedaCodigo, fuente: tc.fuente }
}

// La Factura Nacional es en CLP: si la moneda de la proforma no es CLP, se exige
// el tipo de cambio (CLP por 1 unidad) para convertir al facturar.
function validarTipoCambio(codigoMoneda: string, tipoCambio: number | null | undefined) {
  if (codigoMoneda === 'CLP') return
  if (tipoCambio == null || tipoCambio <= 0) {
    throw new ValidationError('La moneda no es CLP: indica el tipo de cambio (CLP por 1 unidad de la moneda) para poder facturar')
  }
}

export async function crearProformaMaterial(body: ProformaMaterialCreateInput, creadoPor: string) {
  await validarReferenciasHeader(body)
  const moneda = await repo.getMoneda(body.monedaId)
  if (!moneda) throw new ValidationError('La moneda seleccionada no existe o está bloqueada')
  validarTipoCambio(moneda.codigo, body.tipoCambio)
  // CLP no lleva tipo de cambio: se normaliza a null.
  const tipoCambio = moneda.codigo === 'CLP' ? null : body.tipoCambio
  return repo.createProformaMaterial({ ...body, tipoCambio }, creadoPor)
}

export async function actualizarProformaMaterial(id: number, body: ProformaMaterialUpdateInput, actualizadoPor: string) {
  const actual = await obtenerProformaMaterial(id)
  await validarReferenciasHeader(body)
  const patch: ProformaMaterialUpdateInput = { ...body }
  // Valida/normaliza el tipo de cambio contra la moneda EFECTIVA (la del patch o,
  // si no cambia, la actual). Si la moneda cambia a una no-CLP, el tipo de cambio
  // del mismo PATCH es obligatorio (el anterior era de otra moneda).
  if (body.monedaId !== undefined || body.tipoCambio !== undefined) {
    const moneda = await repo.getMoneda(body.monedaId ?? actual.monedaId)
    if (!moneda) throw new ValidationError('La moneda seleccionada no existe o está bloqueada')
    if (moneda.codigo === 'CLP') {
      patch.tipoCambio = null
    } else {
      const monedaCambia = body.monedaId !== undefined && body.monedaId !== actual.monedaId
      const tc = body.tipoCambio !== undefined
        ? body.tipoCambio
        : monedaCambia
          ? null
          : actual.tipoCambio != null ? Number(actual.tipoCambio) : null
      validarTipoCambio(moneda.codigo, tc)
      if (monedaCambia && body.tipoCambio === undefined) patch.tipoCambio = null
    }
  }
  return repo.updateProformaMaterial(id, patch, actualizadoPor)
}

export async function actualizarPrecioLinea(proformaMaterialId: number, lineaId: number, body: ProformaMaterialLineaUpdateInput) {
  await obtenerProformaMaterial(proformaMaterialId)
  return repo.updateLineaPrecio(proformaMaterialId, lineaId, body)
}

export async function enviarValidacionProformaMaterial(id: number) {
  const proforma = await obtenerProformaMaterial(id)
  // Sin tipo de cambio no se puede convertir la Factura Nacional a CLP.
  validarTipoCambio(proforma.moneda.codigo, proforma.tipoCambio != null ? Number(proforma.tipoCambio) : null)
  return repo.enviarValidacion(id)
}

export async function anularProformaMaterial(id: number) {
  await obtenerProformaMaterial(id)
  return repo.anularProformaMaterial(id)
}
