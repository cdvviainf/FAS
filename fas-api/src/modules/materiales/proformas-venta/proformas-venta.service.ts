import { NotFoundError, ValidationError } from '../../../shared/errors.js'
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

export async function obtenerProformaMaterial(id: number) {
  const proforma = await repo.getProformaMaterialById(id)
  if (!proforma) throw new NotFoundError('Proforma de Venta de Materiales', String(id))
  return proforma
}

export async function crearProformaMaterial(body: ProformaMaterialCreateInput, creadoPor: string) {
  await validarReferenciasHeader(body)
  return repo.createProformaMaterial(body, creadoPor)
}

export async function actualizarProformaMaterial(id: number, body: ProformaMaterialUpdateInput, actualizadoPor: string) {
  await obtenerProformaMaterial(id)
  await validarReferenciasHeader(body)
  return repo.updateProformaMaterial(id, body, actualizadoPor)
}

export async function actualizarPrecioLinea(proformaMaterialId: number, lineaId: number, body: ProformaMaterialLineaUpdateInput) {
  await obtenerProformaMaterial(proformaMaterialId)
  return repo.updateLineaPrecio(proformaMaterialId, lineaId, body)
}

export async function enviarValidacionProformaMaterial(id: number) {
  await obtenerProformaMaterial(id)
  return repo.enviarValidacion(id)
}

export async function anularProformaMaterial(id: number) {
  await obtenerProformaMaterial(id)
  return repo.anularProformaMaterial(id)
}
