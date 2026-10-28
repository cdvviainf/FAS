import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import { siguienteCodigo } from '../../config/prefijos-codigo/prefijos-codigo.service.js'
import * as repo from './pago.repository.js'
import type { AplicarSaldoAFavorInput, CrearPagoInput, PagosListFilters } from './pago.types.js'

// Facturas del cliente con saldo pendiente, para armar la pantalla de pago.
export async function documentosPendientes(clienteId: number, monedaId?: number) {
  const cliente = await repo.getClienteCobranza(clienteId)
  if (!cliente) throw new NotFoundError('Cliente', String(clienteId))
  return repo.getDocumentosPendientesCliente(clienteId, monedaId)
}

export async function crearPago(input: CrearPagoInput, userId: string) {
  // Validaciones previas (errores claros antes de abrir la transacción). Las
  // invariantes de saldo/cliente/moneda se revalidan BAJO lock en el repo.
  const cliente = await repo.getClienteCobranza(input.clienteId)
  if (!cliente) throw new NotFoundError('Cliente', String(input.clienteId))
  // La entidad debe ser un cliente (nacional o extranjero): un pago de cartera
  // se registra contra un cliente, no contra cualquier entidad (alinea la API
  // con el filtro del selector del frontend).
  if (!cliente.tipos.some((t) => t === 'CLIENTE_NACIONAL' || t === 'CLIENTE_EXTRANJERO')) {
    throw new ValidationError('La entidad seleccionada no es un cliente (nacional o extranjero)')
  }
  const moneda = await repo.getMonedaById(input.monedaId)
  if (!moneda) throw new NotFoundError('Moneda', String(input.monedaId))

  const codigo = await siguienteCodigo('pago')
  if (!codigo) {
    throw new ValidationError('No hay un prefijo de código configurado para Pagos (Configuración › Prefijos de Código)')
  }
  return repo.crearPagoTransaccional(input, codigo, userId)
}

export async function listarClientes() {
  return repo.listClientesCobranza()
}

export async function listarMonedas() {
  return repo.listMonedasCobranza()
}

export async function listarPagos(filters: PagosListFilters) {
  return repo.listPagos(filters)
}

export async function obtenerPago(id: number) {
  const pago = await repo.getPagoById(id)
  if (!pago) throw new NotFoundError('Pago', String(id))
  return pago
}

export async function saldosAFavor(clienteId: number) {
  const cliente = await repo.getClienteCobranza(clienteId)
  if (!cliente) throw new NotFoundError('Cliente', String(clienteId))
  return repo.getSaldosAFavorCliente(clienteId)
}

export async function aplicarSaldoAFavor(saldoId: number, input: AplicarSaldoAFavorInput) {
  const saldo = await repo.getSaldoAFavorActivo(saldoId)
  if (!saldo) throw new NotFoundError('Saldo a favor', String(saldoId))
  return repo.aplicarSaldoAFavorTransaccional(saldoId, input.tipoFactura, input.facturaId, input.monto)
}
