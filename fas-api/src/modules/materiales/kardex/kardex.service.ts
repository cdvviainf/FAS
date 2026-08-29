import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './kardex.repository.js'
import type { ClaseMovimientoKardex, KardexFilters, KardexResult, KardexRow, KardexSaldo } from './kardex.types.js'

interface EstadoBodega {
  cantidad: number
  costoPromedio: number
}

function saldoDesde(estado: EstadoBodega): KardexSaldo {
  return { cantidad: estado.cantidad, costoPromedio: estado.costoPromedio, valorizado: estado.cantidad * estado.costoPromedio }
}

export async function obtenerKardex(filters: KardexFilters): Promise<KardexResult> {
  const articulo = await repo.getArticuloActivo(filters.articuloId)
  if (!articulo) throw new NotFoundError('Artículo', String(filters.articuloId))

  const bodegaFiltro = filters.bodegaId ? await repo.getBodegaById(filters.bodegaId) : null
  if (filters.bodegaId && !bodegaFiltro) throw new NotFoundError('Bodega', String(filters.bodegaId))

  if (filters.fechaDesde && filters.fechaHasta && filters.fechaDesde > filters.fechaHasta) {
    throw new ValidationError('La fecha desde no puede ser posterior a la fecha hasta')
  }

  const desde = filters.fechaDesde ? new Date(filters.fechaDesde) : null
  const hasta = filters.fechaHasta ? new Date(`${filters.fechaHasta}T23:59:59.999Z`) : null

  const detalle = await repo.listDetalleDelArticulo(filters.articuloId)

  // Estado corrido por bodega (cantidad + PMP) — se reconstruye reproduciendo
  // el mismo cálculo que el motor transaccional (movimientos.repository.ts:
  // R5/R6) sobre el historial completo del artículo, no solo el rango
  // consultado (el saldo inicial del rango depende de todo lo anterior).
  const estados = new Map<number, EstadoBodega>()
  function estadoDe(bodegaId: number): EstadoBodega {
    let s = estados.get(bodegaId)
    if (!s) {
      s = { cantidad: 0, costoPromedio: 0 }
      estados.set(bodegaId, s)
    }
    return s
  }
  function totalConsolidado(): EstadoBodega {
    let cantidad = 0
    let valor = 0
    for (const s of estados.values()) {
      cantidad += s.cantidad
      valor += s.cantidad * s.costoPromedio
    }
    return { cantidad, costoPromedio: cantidad !== 0 ? valor / cantidad : 0 }
  }

  let saldoInicial: KardexSaldo = { cantidad: 0, costoPromedio: 0, valorizado: 0 }
  const rows: KardexRow[] = []

  for (const linea of detalle) {
    const mov = linea.movimiento
    const clase = mov.tipoMovimiento.clase as ClaseMovimientoKardex
    const cantidad = Number(linea.cantidad)
    const precioLinea = linea.precioUnitario != null ? Number(linea.precioUnitario) : null

    const tocaBodegaFiltro = !bodegaFiltro
      || mov.bodegaOrigenId === bodegaFiltro.id
      || mov.bodegaDestinoId === bodegaFiltro.id
    const relevante = !bodegaFiltro || tocaBodegaFiltro

    let cantidadEntrada = 0
    let cantidadSalida = 0
    let costoUnitario: number | null = null

    if (clase === 'ENTRADA') {
      const destino = estadoDe(mov.bodegaDestinoId!)
      const cantidadActual = destino.cantidad
      const pmpActual = destino.costoPromedio
      const nuevaCantidad = cantidadActual + cantidad
      destino.costoPromedio = precioLinea != null
        ? (cantidadActual * pmpActual + cantidad * precioLinea) / nuevaCantidad
        : pmpActual
      destino.cantidad = nuevaCantidad
      cantidadEntrada = cantidad
      costoUnitario = precioLinea ?? pmpActual
    } else if (clase === 'SALIDA') {
      const origen = estadoDe(mov.bodegaOrigenId!)
      costoUnitario = origen.costoPromedio
      origen.cantidad -= cantidad
      cantidadSalida = cantidad
    } else {
      // TRASLADO: el PMP viaja con la cantidad al destino (R6)
      const origen = estadoDe(mov.bodegaOrigenId!)
      const pmpOrigen = origen.costoPromedio
      origen.cantidad -= cantidad

      const destino = estadoDe(mov.bodegaDestinoId!)
      const cantidadDestino = destino.cantidad
      const nuevaCantidadDestino = cantidadDestino + cantidad
      destino.costoPromedio = (cantidadDestino * destino.costoPromedio + cantidad * pmpOrigen) / nuevaCantidadDestino
      destino.cantidad = nuevaCantidadDestino
      costoUnitario = pmpOrigen

      if (bodegaFiltro?.id === mov.bodegaOrigenId) cantidadSalida = cantidad
      if (bodegaFiltro?.id === mov.bodegaDestinoId) cantidadEntrada = cantidad
      // Consolidado (sin bodegaFiltro): un traslado interno no cambia el
      // total de la empresa — se muestra la fila con entrada/salida en 0.
    }

    if (!relevante) continue

    const enFecha = (!desde || mov.fechaMovimiento >= desde) && (!hasta || mov.fechaMovimiento <= hasta)
    const antesDelRango = desde ? mov.fechaMovimiento < desde : false
    const estado = bodegaFiltro ? estadoDe(bodegaFiltro.id) : totalConsolidado()

    if (antesDelRango) {
      saldoInicial = saldoDesde(estado)
      continue
    }
    if (!enFecha) continue // posterior al rango (fechaHasta): no se muestra ni aporta al saldo inicial

    rows.push({
      movimientoId: mov.id,
      fecha: mov.fechaMovimiento,
      tipoMovimiento: mov.tipoMovimiento,
      clase,
      bodegaOrigen: mov.bodegaOrigen,
      bodegaDestino: mov.bodegaDestino,
      entidad: mov.entidad,
      guiaReferencia: mov.guiaReferencia,
      cantidadEntrada,
      cantidadSalida,
      costoUnitario,
      saldoCantidad: estado.cantidad,
      saldoCostoPromedio: estado.costoPromedio,
      saldoValorizado: estado.cantidad * estado.costoPromedio,
    })
  }

  const saldoFinal = rows.length > 0
    ? {
        cantidad: rows[rows.length - 1].saldoCantidad,
        costoPromedio: rows[rows.length - 1].saldoCostoPromedio,
        valorizado: rows[rows.length - 1].saldoValorizado,
      }
    : saldoInicial

  return { articulo, bodega: bodegaFiltro, saldoInicial, saldoFinal, rows }
}
