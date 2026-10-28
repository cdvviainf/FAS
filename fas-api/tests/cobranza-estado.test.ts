import { describe, expect, it } from 'vitest'
import {
  calcularVencimiento,
  construirCuotasDesdeCondicion,
  derivarEstadoCobranza,
  derivarEstadoCuota,
  distribuirEnCuotas,
  planRefresco,
  sumarMontos,
  type CondicionCuotaInput,
  type CuotaRefrescar,
  type CuotaSaldo,
  type FechasBase,
} from '../src/modules/ventas/cobranza/cobranza-estado.js'

const HOY = new Date(2026, 9, 28) // 2026-10-28 (medianoche local)
const AYER = new Date(2026, 9, 27)
const MANANA = new Date(2026, 9, 29)

const cuota = (over: Partial<CuotaSaldo> = {}): CuotaSaldo => ({
  id: 1,
  montoCuota: 500,
  saldoPendiente: 500,
  montoPagado: 0,
  fechaVencimiento: null,
  ...over,
})

describe('derivarEstadoCuota (CB14)', () => {
  it('PAGADA cuando el saldo llega a 0', () => {
    expect(derivarEstadoCuota(500, 0, MANANA, HOY)).toBe('PAGADA')
  })
  it('PARCIAL cuando 0 < saldo < montoCuota (gana sobre vencida)', () => {
    expect(derivarEstadoCuota(500, 100, AYER, HOY)).toBe('PARCIAL')
  })
  it('PENDIENTE cuando nada pagado y no vencida', () => {
    expect(derivarEstadoCuota(500, 500, MANANA, HOY)).toBe('PENDIENTE')
  })
  it('VENCIDA cuando nada pagado y ya venció', () => {
    expect(derivarEstadoCuota(500, 500, AYER, HOY)).toBe('VENCIDA')
  })
  it('PENDIENTE sin fecha de vencimiento', () => {
    expect(derivarEstadoCuota(500, 500, null, HOY)).toBe('PENDIENTE')
  })
})

describe('derivarEstadoCobranza (CB15, enum reconciliado)', () => {
  it('SIN_CUOTAS cuando no hay cuotas', () => {
    expect(derivarEstadoCobranza([], HOY)).toBe('SIN_CUOTAS')
  })
  it('PAGADA cuando el saldo total es 0 (CB-T9)', () => {
    expect(
      derivarEstadoCobranza(
        [
          { montoCuota: 500, saldoPendiente: 0, fechaVencimiento: AYER },
          { montoCuota: 500, saldoPendiente: 0, fechaVencimiento: AYER },
        ],
        HOY,
      ),
    ).toBe('PAGADA')
  })
  it('PARCIAL cuando algo se pagó pero queda saldo', () => {
    expect(
      derivarEstadoCobranza(
        [
          { montoCuota: 500, saldoPendiente: 0, fechaVencimiento: AYER },
          { montoCuota: 500, saldoPendiente: 100, fechaVencimiento: MANANA },
        ],
        HOY,
      ),
    ).toBe('PARCIAL')
  })
  it('VENCIDA cuando nada pagado y alguna cuota venció', () => {
    expect(
      derivarEstadoCobranza(
        [
          { montoCuota: 500, saldoPendiente: 500, fechaVencimiento: AYER },
          { montoCuota: 500, saldoPendiente: 500, fechaVencimiento: MANANA },
        ],
        HOY,
      ),
    ).toBe('VENCIDA')
  })
  it('PENDIENTE cuando nada pagado y ninguna venció', () => {
    expect(
      derivarEstadoCobranza([{ montoCuota: 500, saldoPendiente: 500, fechaVencimiento: MANANA }], HOY),
    ).toBe('PENDIENTE')
  })
})

describe('distribuirEnCuotas (CB11/D10)', () => {
  it('CB-T6: 900 sobre cuotas de 500 y 500 → primera PAGADA, segunda con saldo 100', () => {
    const cuotas = [cuota({ id: 1 }), cuota({ id: 2 })]
    const { aplicaciones, restante } = distribuirEnCuotas(cuotas, 900, HOY)
    expect(restante).toBe(0)
    expect(aplicaciones).toHaveLength(2)
    expect(aplicaciones[0]).toMatchObject({ cuotaId: 1, monto: 500, nuevoSaldo: 0, estado: 'PAGADA' })
    expect(aplicaciones[1]).toMatchObject({ cuotaId: 2, monto: 400, nuevoSaldo: 100, estado: 'PARCIAL' })
  })

  it('aplica exactamente a una cuota sin tocar la siguiente', () => {
    const cuotas = [cuota({ id: 1 }), cuota({ id: 2 })]
    const { aplicaciones, restante } = distribuirEnCuotas(cuotas, 500, HOY)
    expect(restante).toBe(0)
    expect(aplicaciones).toHaveLength(1)
    expect(aplicaciones[0]).toMatchObject({ cuotaId: 1, nuevoSaldo: 0, estado: 'PAGADA' })
  })

  it('deja restante cuando el monto supera el saldo total (va a saldo a favor)', () => {
    const cuotas = [cuota({ id: 1, montoCuota: 500, saldoPendiente: 500 })]
    const { aplicaciones, restante } = distribuirEnCuotas(cuotas, 700, HOY)
    expect(aplicaciones).toHaveLength(1)
    expect(aplicaciones[0].monto).toBe(500)
    expect(restante).toBe(200)
  })

  it('salta cuotas ya pagadas', () => {
    const cuotas = [cuota({ id: 1, saldoPendiente: 0, montoPagado: 500 }), cuota({ id: 2 })]
    const { aplicaciones } = distribuirEnCuotas(cuotas, 300, HOY)
    expect(aplicaciones).toHaveLength(1)
    expect(aplicaciones[0]).toMatchObject({ cuotaId: 2, monto: 300, nuevoSaldo: 200, estado: 'PARCIAL' })
  })
})

describe('construirCuotasDesdeCondicion (CB5/CB6)', () => {
  const fechas = { FACTURA: new Date(2026, 0, 1), ZARPE: null, ARRIBO: null, ENVIO_DOCUMENTOS: null }

  it('PORCENTAJE 60/40 reparte el total y Σ == montoTotal', () => {
    const cond: CondicionCuotaInput[] = [
      { fechaReferencia: 'FACTURA', plazoDias: 30, tipoValor: 'PORCENTAJE', porcentaje: 60, valorUnitario: null },
      { fechaReferencia: 'FACTURA', plazoDias: 60, tipoValor: 'PORCENTAJE', porcentaje: 40, valorUnitario: null },
    ]
    const cuotas = construirCuotasDesdeCondicion(cond, 1000, 0, fechas)
    expect(cuotas.map((c) => c.montoCuota)).toEqual([600, 400])
    expect(sumarMontos(cuotas.map((c) => c.montoCuota))).toBe(1000)
    // Vencimiento = FACTURA + plazoDias.
    expect(cuotas[0].fechaVencimiento).toEqual(new Date(2026, 0, 31))
    expect(cuotas[1].fechaVencimiento).toEqual(new Date(2026, 2, 2)) // 1-ene + 60 días
  })

  it('ajusta el redondeo en la última cuota para cuadrar con el total', () => {
    const cond: CondicionCuotaInput[] = [
      { fechaReferencia: 'FACTURA', plazoDias: 0, tipoValor: 'PORCENTAJE', porcentaje: 33.33, valorUnitario: null },
      { fechaReferencia: 'FACTURA', plazoDias: 0, tipoValor: 'PORCENTAJE', porcentaje: 33.33, valorUnitario: null },
      { fechaReferencia: 'FACTURA', plazoDias: 0, tipoValor: 'PORCENTAJE', porcentaje: 33.34, valorUnitario: null },
    ]
    const cuotas = construirCuotasDesdeCondicion(cond, 100, 0, fechas)
    expect(sumarMontos(cuotas.map((c) => c.montoCuota))).toBe(100)
  })

  it('MONTO_UNITARIO = valorUnitario × cantidad total', () => {
    const cond: CondicionCuotaInput[] = [
      { fechaReferencia: 'FACTURA', plazoDias: 0, tipoValor: 'MONTO_UNITARIO', porcentaje: null, valorUnitario: 2 },
    ]
    const cuotas = construirCuotasDesdeCondicion(cond, 200, 50, fechas)
    // 2 × 50 = 100; el ajuste de redondeo lleva la última (única) cuota al total.
    expect(cuotas).toHaveLength(1)
    expect(cuotas[0].montoCuota).toBe(200)
  })

  it('sin cuotas en la condición → sin cuotas', () => {
    expect(construirCuotasDesdeCondicion([], 1000, 0, fechas)).toEqual([])
  })
})

describe('calcularVencimiento (CB6)', () => {
  it('fechaBase + plazoDias', () => {
    expect(calcularVencimiento(new Date(Date.UTC(2026, 0, 1)), 30)).toEqual(new Date(Date.UTC(2026, 0, 31)))
  })
  it('null si no hay fecha base', () => {
    expect(calcularVencimiento(null, 30)).toBeNull()
  })
})

describe('planRefresco (Ciclo 3 — CB6/CB14/CB15/D7)', () => {
  const fechas: FechasBase = {
    FACTURA: new Date(Date.UTC(2026, 9, 1)),
    ZARPE: new Date(Date.UTC(2026, 9, 10)),
    ARRIBO: null,
    ENVIO_DOCUMENTOS: null,
  }
  const cuotaRef = (over: Partial<CuotaRefrescar> = {}): CuotaRefrescar => ({
    id: 1,
    fechaReferencia: 'FACTURA',
    plazoDias: 0,
    montoCuota: 100,
    saldoPendiente: 100,
    fechaVencimiento: null,
    estado: 'PENDIENTE',
    ...over,
  })

  it('recalcula el vencimiento desde la fecha base (CB6) y marca VENCIDA si ya pasó', () => {
    // FACTURA=1-oct + 0 días = 1-oct; hoy = 15-oct → vencida.
    const hoy = new Date(Date.UTC(2026, 9, 15))
    const { cuotaUpdates, estadoCobranza } = planRefresco([cuotaRef()], fechas, hoy)
    expect(cuotaUpdates).toHaveLength(1)
    expect(cuotaUpdates[0]).toMatchObject({ id: 1, estado: 'VENCIDA' })
    expect(cuotaUpdates[0].fechaVencimiento).toEqual(new Date(Date.UTC(2026, 9, 1)))
    expect(estadoCobranza).toBe('VENCIDA')
  })

  it('borde: una cuota que vence HOY no está vencida', () => {
    // FACTURA=1-oct + 0 días = 1-oct; hoy = 1-oct → NO vencida.
    const hoy = new Date(Date.UTC(2026, 9, 1))
    const { cuotaUpdates, estadoCobranza } = planRefresco([cuotaRef({ fechaVencimiento: new Date(Date.UTC(2026, 9, 1)) })], fechas, hoy)
    // La fecha no cambia y el estado sigue PENDIENTE → sin updates.
    expect(cuotaUpdates).toHaveLength(0)
    expect(estadoCobranza).toBe('PENDIENTE')
  })

  it('al moverse la fecha base hacia el futuro, una cuota deja de estar vencida (D7)', () => {
    // Cuota ZARPE estaba vencida con una fecha vieja; el zarpe se movió al 10-oct.
    const hoy = new Date(Date.UTC(2026, 9, 5))
    const cuota = cuotaRef({ fechaReferencia: 'ZARPE', plazoDias: 0, fechaVencimiento: new Date(Date.UTC(2026, 8, 1)), estado: 'VENCIDA' })
    const { cuotaUpdates, estadoCobranza } = planRefresco([cuota], fechas, hoy)
    expect(cuotaUpdates).toHaveLength(1)
    expect(cuotaUpdates[0].fechaVencimiento).toEqual(new Date(Date.UTC(2026, 9, 10)))
    expect(cuotaUpdates[0].estado).toBe('PENDIENTE')
    expect(estadoCobranza).toBe('PENDIENTE')
  })

  it('no toca cuotas PAGADA (D7: conserva su fecha histórica)', () => {
    const hoy = new Date(Date.UTC(2026, 9, 15))
    const pagada = cuotaRef({ estado: 'PAGADA', saldoPendiente: 0, fechaVencimiento: new Date(Date.UTC(2026, 0, 1)) })
    const { cuotaUpdates, estadoCobranza } = planRefresco([pagada], fechas, hoy)
    expect(cuotaUpdates).toHaveLength(0)
    expect(estadoCobranza).toBe('PAGADA')
  })

  it('cuota PARCIAL vencida se mantiene PARCIAL (el parcial gana, CB14)', () => {
    const hoy = new Date(Date.UTC(2026, 9, 15))
    const parcial = cuotaRef({ estado: 'PARCIAL', saldoPendiente: 40, fechaVencimiento: new Date(Date.UTC(2026, 9, 1)) })
    const { cuotaUpdates, estadoCobranza } = planRefresco([parcial], fechas, hoy)
    // fecha no cambia (FACTURA+0 = 1-oct), estado sigue PARCIAL → sin updates.
    expect(cuotaUpdates).toHaveLength(0)
    expect(estadoCobranza).toBe('PARCIAL')
  })
})
