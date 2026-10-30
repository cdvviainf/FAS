import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import { siguienteCodigo } from '../../config/prefijos-codigo/prefijos-codigo.service.js'
import { obtenerTipoCambio } from '../../finanzas/facturacion/tipo-cambio.adapter.js'
import * as repo from './pago.repository.js'
import type { AplicarSaldoAFavorInput, CrearPagoInput, PagosListFilters } from './pago.types.js'

// Cartera por cliente (landing de Pagos) con todos los montos convertidos a USD
// (dólar/euro observado del Banco Central). Una fila por cliente.
export async function resumenCartera() {
  const facturas = await repo.getCarteraFacturasRaw()

  // Tipo de cambio = CLP por unidad de cada moneda (CLP = 1). USD es obligatorio
  // para expresar la cartera en dólares; el resto se pide por cada moneda presente.
  const rateClp: Record<string, number> = { CLP: 1 }
  const tcUsd = await obtenerTipoCambio('USD')
  if ('error' in tcUsd) {
    throw new ValidationError(`No se pudo obtener el tipo de cambio del dólar para expresar la cartera en USD: ${tcUsd.error}`)
  }
  rateClp.USD = tcUsd.valor
  for (const cod of new Set(facturas.map((f) => f.monedaCodigo.toUpperCase()))) {
    if (rateClp[cod] != null) continue
    const tc = await obtenerTipoCambio(cod)
    if (!('error' in tc)) rateClp[cod] = tc.valor
  }
  const rateUsd = rateClp.USD
  const toUsd = (monto: number, cod: string): number | null => {
    const r = rateClp[cod.toUpperCase()]
    return r == null ? null : monto * (r / rateUsd)
  }

  type Acumulado = {
    cliente: { id: number; codigo: string; descripcion: string; razonSocial: string }
    facturado: number
    pagado: number
    pendiente: number
    vencido: number
  }
  const porCliente = new Map<number, Acumulado>()
  const monedasSinTc = new Set<string>()
  for (const f of facturas) {
    const facturadoUsd = toUsd(f.montoTotal, f.monedaCodigo)
    if (facturadoUsd == null) {
      monedasSinTc.add(f.monedaCodigo)
      continue // moneda sin tipo de cambio → no se puede convertir a USD
    }
    const pendienteUsd = toUsd(f.saldoPendiente, f.monedaCodigo) ?? 0
    const vencidoUsd = toUsd(f.vencido, f.monedaCodigo) ?? 0
    const acc = porCliente.get(f.clienteId) ?? { cliente: f.cliente, facturado: 0, pagado: 0, pendiente: 0, vencido: 0 }
    acc.facturado += facturadoUsd
    acc.pagado += facturadoUsd - pendienteUsd
    acc.pendiente += pendienteUsd
    acc.vencido += vencidoUsd
    porCliente.set(f.clienteId, acc)
  }

  const round2 = (n: number) => Math.round(n * 100) / 100
  const data = [...porCliente.entries()]
    .map(([clienteId, a]) => ({
      clienteId,
      cliente: a.cliente,
      facturado: round2(a.facturado),
      pagado: round2(a.pagado),
      pendiente: round2(a.pendiente),
      vencido: round2(a.vencido),
      // Estado de deuda derivado del agregado.
      estado: a.vencido > 0.005 ? ('VENCIDA' as const) : a.pendiente > 0.005 ? ('PENDIENTE' as const) : ('AL_DIA' as const),
    }))
    .sort((x, y) => y.vencido - x.vencido || y.pendiente - x.pendiente || y.facturado - x.facturado)

  return {
    data,
    moneda: 'USD',
    tipoCambioUsd: rateUsd,
    fechaTipoCambio: tcUsd.fecha,
    monedasSinTipoCambio: [...monedasSinTc],
  }
}

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
