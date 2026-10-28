// Helpers compartidos de Cobranza (Ciclo 2, Docs/cobranza.md §5): derivación del
// estado de una cuota (CB14) y del estado de cartera de una factura (CB15), y la
// construcción de cuotas de la Factura Nacional desde su CondicionPago (espejo de
// `construirCuotas` de la Factura de Exportación, que las toma del snapshot
// NotaVentaCuotaPago del Cierre Comercial — la Nacional no tiene Cierre, así que
// se arman directo desde la condición de pago).
import type { EstadoCobranza, FechaReferenciaPago, TipoValorCuota } from '@prisma/client'

// Los enums EstadoCuotaFacturaExportacion y EstadoCuotaFacturaNacional comparten
// exactamente los mismos valores — un solo tipo string sirve para ambos.
export type EstadoCuotaCobranza = 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'VENCIDA'

const DIA_MS = 86_400_000
const round2 = (n: number) => Math.round(n * 100) / 100

// Suma montos en centavos enteros para evitar acumular error de float (mismo
// criterio que factura-exportacion.service.ts).
export function sumarMontos(montos: number[]): number {
  const centavos = montos.reduce((acc, m) => acc + Math.round(m * 100), 0)
  return centavos / 100
}

// Medianoche de hoy en UTC: una cuota que vence HOY todavía no está vencida. Se
// usa UTC (no la hora local del proceso) a propósito: las fechas de vencimiento
// se derivan de fechas-calendario `YYYY-MM-DD` que Prisma persiste como
// medianoche UTC, así que comparar contra la medianoche UTC de hoy alinea el
// límite de día exactamente con el almacenamiento, sin depender de la TZ del
// contenedor (FAS-COB-VEN-R1, residual de zona horaria).
export function inicioDeHoy(): Date {
  const ahora = new Date()
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()))
}

// Estado de una cuota tras una mutación (CB14). El parcial gana sobre vencida:
// una cuota con pago parcial queda PARCIAL aunque esté atrasada (spec CB14).
export function derivarEstadoCuota(
  montoCuota: number,
  saldoPendiente: number,
  fechaVencimiento: Date | null,
  hoy: Date,
): EstadoCuotaCobranza {
  if (saldoPendiente <= 0) return 'PAGADA'
  if (saldoPendiente < montoCuota) return 'PARCIAL'
  // Nada pagado (saldoPendiente == montoCuota).
  if (fechaVencimiento && fechaVencimiento < hoy) return 'VENCIDA'
  return 'PENDIENTE'
}

// Estado de cartera de la factura, derivado del agregado de sus cuotas (CB15,
// enum reconciliado §0.e: SIN_CUOTAS/PENDIENTE/PARCIAL/PAGADA/VENCIDA). Separado
// del estado SII (BORRADOR/APROBADA/...).
export function derivarEstadoCobranza(
  cuotas: Array<{ montoCuota: number; saldoPendiente: number; fechaVencimiento: Date | null }>,
  hoy: Date,
): EstadoCobranza {
  if (cuotas.length === 0) return 'SIN_CUOTAS'
  const totalSaldo = sumarMontos(cuotas.map((c) => c.saldoPendiente))
  const totalMonto = sumarMontos(cuotas.map((c) => c.montoCuota))
  if (totalSaldo <= 0) return 'PAGADA'
  // Hubo algún pago si el saldo total bajó respecto del monto total.
  if (totalSaldo < totalMonto) return 'PARCIAL'
  // Nada pagado: VENCIDA si alguna cuota ya venció, si no PENDIENTE.
  const algunaVencida = cuotas.some((c) => c.fechaVencimiento && c.fechaVencimiento < hoy)
  return algunaVencida ? 'VENCIDA' : 'PENDIENTE'
}

// Vencimiento = fecha base (según la referencia) + plazoDias (CB6). null si no
// hay fecha base resoluble (p. ej. ZARPE sin reserva, ENVIO_DOCUMENTOS).
export function calcularVencimiento(fechaBase: Date | null, plazoDias: number): Date | null {
  return fechaBase ? new Date(fechaBase.getTime() + plazoDias * DIA_MS) : null
}

// ─── Cascada de aplicación a cuotas (CB11/D10) — función pura ─────────────────
export interface CuotaSaldo {
  id: number
  montoCuota: number
  saldoPendiente: number
  montoPagado: number
  fechaVencimiento: Date | null
}

export interface AplicacionCuota {
  cuotaId: number
  monto: number
  nuevoSaldo: number
  nuevoPagado: number
  estado: EstadoCuotaCobranza
}

// Distribuye `monto` (en la moneda de la factura) sobre las cuotas en orden de
// entrada (que debe venir por numeroCuota ascendente, CB11/D10), hasta el
// saldoPendiente de cada una; el excedente pasa a la siguiente cuota. Función
// pura: NO toca la BD — devuelve qué aplicar a cada cuota y el `restante` no
// absorbido (0 cuando monto ≤ Σ saldoPendiente). El caller persiste y decide
// qué hacer con el restante (saldo a favor).
export function distribuirEnCuotas(cuotas: CuotaSaldo[], monto: number, hoy: Date): { aplicaciones: AplicacionCuota[]; restante: number } {
  const aplicaciones: AplicacionCuota[] = []
  let restante = round2(monto)
  for (const cuota of cuotas) {
    if (restante <= 0) break
    if (cuota.saldoPendiente <= 0) continue
    const aplicar = round2(Math.min(restante, cuota.saldoPendiente))
    if (aplicar <= 0) continue
    const nuevoSaldo = round2(cuota.saldoPendiente - aplicar)
    const nuevoPagado = round2(cuota.montoPagado + aplicar)
    aplicaciones.push({
      cuotaId: cuota.id,
      monto: aplicar,
      nuevoSaldo,
      nuevoPagado,
      estado: derivarEstadoCuota(cuota.montoCuota, nuevoSaldo, cuota.fechaVencimiento, hoy),
    })
    restante = round2(restante - aplicar)
  }
  return { aplicaciones, restante }
}

// ─── Refresco diario de cartera (Ciclo 3, CB6/CB14/CB15/D7) — función pura ────
export type FechasBase = Record<FechaReferenciaPago, Date | null>

export interface CuotaRefrescar {
  id: number
  fechaReferencia: FechaReferenciaPago
  plazoDias: number
  montoCuota: number
  saldoPendiente: number
  fechaVencimiento: Date | null
  estado: EstadoCuotaCobranza
}

export interface PlanRefresco {
  cuotaUpdates: Array<{ id: number; fechaVencimiento: Date | null; estado: EstadoCuotaCobranza }>
  estadoCobranza: EstadoCobranza
}

// Recalcula, para cada cuota NO pagada, su `fechaVencimiento` desde la fecha base
// actual (CB6) y deriva su estado (CB14); las cuotas PAGADA conservan su fecha
// histórica y su estado (D7). Deriva el estadoCobranza de la factura del agregado
// (CB15). Devuelve solo las cuotas que cambian (fecha o estado) y el nuevo
// estadoCobranza. Pura: NO toca la BD.
export function planRefresco(cuotas: CuotaRefrescar[], fechas: FechasBase, hoy: Date): PlanRefresco {
  const cuotaUpdates: PlanRefresco['cuotaUpdates'] = []
  const agregado: Array<{ montoCuota: number; saldoPendiente: number; fechaVencimiento: Date | null }> = []
  for (const c of cuotas) {
    if (c.estado === 'PAGADA') {
      agregado.push({ montoCuota: c.montoCuota, saldoPendiente: c.saldoPendiente, fechaVencimiento: c.fechaVencimiento })
      continue
    }
    const nuevaVenc = calcularVencimiento(fechas[c.fechaReferencia], c.plazoDias)
    const nuevoEstado = derivarEstadoCuota(c.montoCuota, c.saldoPendiente, nuevaVenc, hoy)
    agregado.push({ montoCuota: c.montoCuota, saldoPendiente: c.saldoPendiente, fechaVencimiento: nuevaVenc })
    const fechaCambia = (c.fechaVencimiento?.getTime() ?? null) !== (nuevaVenc?.getTime() ?? null)
    if (fechaCambia || nuevoEstado !== c.estado) {
      cuotaUpdates.push({ id: c.id, fechaVencimiento: nuevaVenc, estado: nuevoEstado })
    }
  }
  return { cuotaUpdates, estadoCobranza: derivarEstadoCobranza(agregado, hoy) }
}

export interface CuotaCalculada {
  numeroCuota: number
  fechaReferencia: FechaReferenciaPago
  plazoDias: number
  montoCuota: number
  fechaVencimiento: Date | null
}

export interface CondicionCuotaInput {
  fechaReferencia: FechaReferenciaPago
  plazoDias: number
  tipoValor: TipoValorCuota
  porcentaje: number | null
  valorUnitario: number | null
}

// Construye las cuotas de una Factura Nacional a partir de las cuotas de su
// CondicionPago (CB5/CB6, adaptado): PORCENTAJE = % del montoTotal;
// MONTO_UNITARIO = valorUnitario × cantidad total de la factura (en la moneda de
// la factura — la Nacional siempre es CLP, sin conversión de la cuota). El
// descuadre de redondeo se ajusta en la última cuota para que Σ montoCuota ==
// montoTotal. Devuelve [] si la condición no tiene cuotas.
export function construirCuotasDesdeCondicion(
  cuotasCondicion: CondicionCuotaInput[],
  montoTotal: number,
  cantidadTotal: number,
  fechasPorReferencia: Record<FechaReferenciaPago, Date | null>,
): CuotaCalculada[] {
  if (cuotasCondicion.length === 0) return []

  const cuotas: CuotaCalculada[] = cuotasCondicion.map((c, i) => {
    const montoBruto =
      c.tipoValor === 'PORCENTAJE'
        ? (Number(c.porcentaje ?? 0) / 100) * montoTotal
        : Number(c.valorUnitario ?? 0) * cantidadTotal
    const fechaBase = fechasPorReferencia[c.fechaReferencia]
    const fechaVencimiento = fechaBase ? new Date(fechaBase.getTime() + c.plazoDias * DIA_MS) : null
    return {
      numeroCuota: i + 1,
      fechaReferencia: c.fechaReferencia,
      plazoDias: c.plazoDias,
      montoCuota: round2(montoBruto),
      fechaVencimiento,
    }
  })

  // Ajuste de redondeo en la última cuota para que Σ montoCuota == montoTotal.
  const suma = sumarMontos(cuotas.map((c) => c.montoCuota))
  const diff = round2(montoTotal - suma)
  if (diff !== 0) {
    const ultima = cuotas[cuotas.length - 1]
    ultima.montoCuota = round2(ultima.montoCuota + diff)
  }
  return cuotas
}
