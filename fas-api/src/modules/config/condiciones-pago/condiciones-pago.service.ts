import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './condiciones-pago.repository.js'
import type { CondicionPagoCreateInput, CondicionPagoUpdateInput, CondicionPagoCuotaInput, TipoCondicionPago } from './condiciones-pago.types.js'

// La cuota de monto unitario solo admite unidad Caja o Kilo (codigo 'CAJA'
// o 'KG', sembradas en el seed) — cualquier otra UnidadMedida se rechaza
// para no calcular un monto contra una unidad sin sentido de negocio.
const UNIDADES_MONTO_UNITARIO = ['CAJA', 'KG']

async function validarCuotas(cuotas: CondicionPagoCuotaInput[]) {
  for (const cuota of cuotas) {
    if (cuota.tipoValor !== 'MONTO_UNITARIO') continue
    const [moneda, unidad] = await Promise.all([
      repo.getMoneda(cuota.monedaId!),
      repo.getUnidadMedida(cuota.unidadId!),
    ])
    if (!moneda) throw new ValidationError('La moneda seleccionada para la cuota de monto unitario no existe o está bloqueada')
    if (!unidad) throw new ValidationError('La unidad (Caja/Kilo) seleccionada para la cuota de monto unitario no existe o está bloqueada')
    if (!UNIDADES_MONTO_UNITARIO.includes(unidad.codigo)) {
      throw new ValidationError('La cuota de monto unitario solo admite unidad Caja o Kilo')
    }
  }
}

export async function listarCondicionesPago(q?: string, tipo?: TipoCondicionPago) {
  return repo.listCondicionesPago(q, tipo)
}

export async function obtenerCondicionPago(id: number) {
  const condicionPago = await repo.getCondicionPagoById(id)
  if (!condicionPago) throw new NotFoundError('Condición de Pago', String(id))
  return condicionPago
}

export async function crearCondicionPago(body: CondicionPagoCreateInput, userId: string) {
  const existente = await repo.findCondicionPagoByCodigo(body.codigo)
  if (existente) throw new ValidationError(`Ya existe una Condición de Pago con código "${body.codigo}"`)
  await validarCuotas(body.cuotas)
  return repo.createCondicionPago(body, userId)
}

export async function actualizarCondicionPago(id: number, body: CondicionPagoUpdateInput, userId: string) {
  await obtenerCondicionPago(id)
  if (body.cuotas) await validarCuotas(body.cuotas)
  return repo.updateCondicionPago(id, body, userId)
}

export async function eliminarCondicionPago(id: number, userId: string) {
  await obtenerCondicionPago(id)
  await repo.softDeleteCondicionPago(id, userId)
}
