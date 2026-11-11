// Cálculo PURO (sin BD) de lo despachado por OC × Embarque y sus cuotas de pago
// (Solicitud de Pago a Productores, 2026-11-10). Se usa para mostrar lo
// despachado y para revalidar server-side lo que se solicita.

const DIA_MS = 24 * 60 * 60 * 1000
const round2 = (n: number) => Math.round(n * 100) / 100

export type FechaReferencia = 'FACTURA' | 'ZARPE' | 'ENVIO_DOCUMENTOS' | 'ARRIBO'

export interface LineaOcPrecio {
  id: number
  especieId: number
  variedadId: number
  categoriaId: number | null
  articuloId: number
  etiquetaId: number | null
  calibreIds: number[]
  precioUsdCaja: number | null
}

export interface LineaPalletDespachada {
  palletId: number
  numeroPallet: string
  especieId: number
  variedadId: number
  categoriaId: number
  articuloId: number
  etiquetaId: number | null
  calibreId: number
  cajas: number
  kgNetoEnvase: number | null
  // Descripciones para mostrar.
  especie: string
  variedad: string
  categoria: string
  calibre: string
  embalaje: string
  etiqueta: string | null
}

export interface CuotaOc {
  id: number
  fechaReferencia: FechaReferencia
  plazoDias: number
  tipoValor: 'PORCENTAJE' | 'MONTO_UNITARIO'
  porcentaje: number | null
  valorUnitario: number | null
  unidadCodigo: string | null
  monedaId: number | null
  descripcion: string | null
}

export interface DetallePalletValorizado extends LineaPalletDespachada {
  precio: number | null
  monto: number
  // Motivo si no hay precio (no calza o calza con precios distintos).
  pendiente: string | null
}

export interface CuotaDespachada {
  ordenCompraCuotaPagoId: number | null
  numeroCuota: number
  descripcion: string
  fechaReferencia: FechaReferencia
  plazoDias: number
  fechaVencimiento: Date | null
  montoCalculado: number
}

// Precio de una línea de pallet según las líneas de la OC que calzan (mismo
// criterio que la Recepción contra la OC): especie + variedad + embalaje
// iguales; categoría y etiqueta iguales cuando la línea de OC las define;
// calibre dentro de la lista de la línea (sin lista = cualquiera). Si hay líneas
// con la etiqueta del pallet se prefieren a las genéricas. Debe resultar UN
// precio: sin calce o con precios distintos queda pendiente.
export function precioParaLinea(l: LineaPalletDespachada, lineasOc: LineaOcPrecio[]): { precio: number | null; pendiente: string | null } {
  const candidatas = lineasOc.filter(
    (o) =>
      o.especieId === l.especieId &&
      o.variedadId === l.variedadId &&
      o.articuloId === l.articuloId &&
      (o.categoriaId == null || o.categoriaId === l.categoriaId) &&
      (o.etiquetaId == null || o.etiquetaId === l.etiquetaId) &&
      (o.calibreIds.length === 0 || o.calibreIds.includes(l.calibreId)),
  )
  const especificas = candidatas.filter((o) => o.etiquetaId != null)
  const elegidas = especificas.length > 0 ? especificas : candidatas
  if (elegidas.length === 0) return { precio: null, pendiente: 'No calza con ninguna línea de la OC' }
  const precios = [...new Set(elegidas.map((o) => o.precioUsdCaja).filter((p): p is number => p != null))]
  if (precios.length === 0) return { precio: null, pendiente: 'La línea de la OC no tiene precio por caja' }
  if (precios.length > 1) return { precio: null, pendiente: 'Calza con líneas de la OC de precios distintos' }
  return { precio: precios[0], pendiente: null }
}

export interface ResultadoGrupo {
  detalle: DetallePalletValorizado[]
  cajas: number
  kilos: number | null // null si algún embalaje no tiene kg neto
  monto: number
  bloqueos: string[]
  cuotas: CuotaDespachada[]
}

// Valoriza lo despachado de una OC en un Embarque y arma sus cuotas.
export function calcularGrupo(
  lineasPallet: LineaPalletDespachada[],
  lineasOc: LineaOcPrecio[],
  cuotasOc: CuotaOc[],
  opts: { monedaOcId: number; modalidad: 'CAJAS' | 'GRANEL'; fechaZarpe: Date | null; fechaArribo: Date | null },
): ResultadoGrupo {
  const bloqueos: string[] = []
  if (opts.modalidad === 'GRANEL') bloqueos.push('OC a granel: la solicitud de pago por lo despachado aplica a OC por cajas')

  const detalle: DetallePalletValorizado[] = lineasPallet.map((l) => {
    const { precio, pendiente } = precioParaLinea(l, lineasOc)
    return { ...l, precio, pendiente, monto: precio != null ? round2(precio * l.cajas) : 0 }
  })
  const pendientes = detalle.filter((d) => d.pendiente)
  if (pendientes.length > 0) {
    bloqueos.push(`Precio pendiente en ${pendientes.length} línea(s) de pallet: corrige la OC para poder solicitar el pago`)
  }

  const cajas = detalle.reduce((a, d) => a + d.cajas, 0)
  const kilos = detalle.every((d) => d.kgNetoEnvase != null && d.kgNetoEnvase > 0)
    ? Math.round(detalle.reduce((a, d) => a + d.cajas * (d.kgNetoEnvase ?? 0), 0) * 100) / 100
    : null
  const monto = round2(detalle.reduce((a, d) => a + d.monto, 0))

  const fechaBase = (ref: FechaReferencia): Date | null =>
    ref === 'ZARPE' ? opts.fechaZarpe : ref === 'ARRIBO' ? opts.fechaArribo : null // FACTURA / ENVIO_DOCUMENTOS: sin fecha aún

  // OC sin condición de pago: una cuota implícita por el 100%.
  const base: CuotaOc[] =
    cuotasOc.length > 0
      ? cuotasOc
      : [{ id: 0, fechaReferencia: 'FACTURA', plazoDias: 0, tipoValor: 'PORCENTAJE', porcentaje: 100, valorUnitario: null, unidadCodigo: null, monedaId: null, descripcion: 'Total (OC sin condición de pago)' }]

  const cuotas: CuotaDespachada[] = base.map((c, i) => {
    let montoCuota = 0
    if (c.monedaId != null && c.monedaId !== opts.monedaOcId) {
      bloqueos.push(`La cuota ${i + 1} está en una moneda distinta a la de la OC`)
    }
    if (c.tipoValor === 'PORCENTAJE') {
      montoCuota = round2(((c.porcentaje ?? 0) / 100) * monto)
    } else if (c.unidadCodigo === 'KG') {
      if (kilos == null) bloqueos.push(`La cuota ${i + 1} es por kilo y un embalaje despachado no tiene kg neto cargado`)
      montoCuota = round2((c.valorUnitario ?? 0) * (kilos ?? 0))
    } else {
      montoCuota = round2((c.valorUnitario ?? 0) * cajas)
    }
    const fb = fechaBase(c.fechaReferencia)
    return {
      ordenCompraCuotaPagoId: c.id === 0 ? null : c.id,
      numeroCuota: i + 1,
      descripcion: c.descripcion?.trim() || (c.tipoValor === 'PORCENTAJE' ? `${c.porcentaje ?? 0}%` : `${c.valorUnitario ?? 0} por ${c.unidadCodigo === 'KG' ? 'kilo' : 'caja'}`),
      fechaReferencia: c.fechaReferencia,
      plazoDias: c.plazoDias,
      fechaVencimiento: fb ? new Date(fb.getTime() + c.plazoDias * DIA_MS) : null,
      montoCalculado: montoCuota,
    }
  })

  // Ajuste de redondeo: si todas son porcentuales y suman 100%, Σ cuotas = monto.
  const todasPct = base.every((c) => c.tipoValor === 'PORCENTAJE')
  const sumaPct = base.reduce((a, c) => a + (c.tipoValor === 'PORCENTAJE' ? (c.porcentaje ?? 0) : 0), 0)
  if (todasPct && Math.abs(sumaPct - 100) < 0.0001 && cuotas.length > 0) {
    const diff = round2(monto - cuotas.reduce((a, c) => a + c.montoCalculado, 0))
    if (diff !== 0) cuotas[cuotas.length - 1].montoCalculado = round2(cuotas[cuotas.length - 1].montoCalculado + diff)
  }

  return { detalle, cajas, kilos, monto, bloqueos: [...new Set(bloqueos)], cuotas }
}

// Clave de una cuota despachada (OC × Embarque × cuota).
export function claveCuota(ordenCompraId: number, embarqueId: number, ordenCompraCuotaPagoId: number | null): string {
  return `${ordenCompraId}|${embarqueId}|${ordenCompraCuotaPagoId ?? 'total'}`
}
