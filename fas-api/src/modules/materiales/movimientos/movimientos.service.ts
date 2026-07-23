import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './movimientos.repository.js'
import { StockInsuficienteError } from './movimientos.repository.js'
import type { MovimientoCreateInput, MovimientoListFilters } from './movimientos.types.js'

export async function listarMovimientos(filters: MovimientoListFilters) {
  const { data, total } = await repo.listMovimientos(filters)
  const { page = 1, limit = 20 } = filters
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function obtenerMovimiento(id: number) {
  const movimiento = await repo.getMovimientoById(id)
  if (!movimiento) throw new NotFoundError('Movimiento', String(id))
  return movimiento
}

export async function crearMovimiento(body: MovimientoCreateInput, userId: string) {
  // R14: el tipo de movimiento debe aplicar al módulo Materiales
  const tipoMovimiento = await repo.getTipoMovimientoActivo(body.tipoMovimientoId)
  if (!tipoMovimiento) throw new ValidationError('El tipo de movimiento no existe o está inactivo')
  if (!tipoMovimiento.modulos.includes('MATERIALES')) {
    throw new ValidationError('Este tipo de movimiento no aplica al módulo Materiales (R14)')
  }

  // R11: clase y bodegas requeridas
  const clase = tipoMovimiento.clase
  if (clase === 'ENTRADA' && !body.bodegaDestinoId) {
    throw new ValidationError('Un movimiento de Entrada requiere bodega de destino (R11)')
  }
  if (clase === 'SALIDA' && !body.bodegaOrigenId) {
    throw new ValidationError('Un movimiento de Salida requiere bodega de origen (R11)')
  }
  if (clase === 'TRASLADO' && (!body.bodegaOrigenId || !body.bodegaDestinoId)) {
    throw new ValidationError('Un movimiento de Traslado requiere bodega de origen y destino (R11)')
  }

  // R9: precio requerido por línea si el tipo lo exige
  if (tipoMovimiento.requierePrecio) {
    const sinPrecio = body.detalle.filter((d) => d.precioUnitario == null)
    if (sinPrecio.length > 0) {
      throw new ValidationError('Este tipo de movimiento exige precio unitario en todas las líneas (R9)')
    }
  }

  // R10: datos de transporte si emite DTE
  if (tipoMovimiento.emiteDTE) {
    const faltantes: string[] = []
    if (!body.transporteEntidadId) faltantes.push('empresa de transporte')
    if (!body.choferRut) faltantes.push('RUT del chofer')
    if (!body.choferNombre) faltantes.push('nombre del chofer')
    if (!body.placaCamion) faltantes.push('placa del camión')
    if (!body.horaSalida) faltantes.push('hora de salida')
    if (faltantes.length > 0) {
      throw new ValidationError(`Este tipo de movimiento emite DTE y requiere: ${faltantes.join(', ')} (R10)`)
    }
    const transportista = await repo.getEntidadActiva(body.transporteEntidadId!)
    if (!transportista) throw new ValidationError('La empresa de transporte no existe o está inactiva')
    if (!transportista.tipos.includes('EMPRESA_TRANSPORTE')) {
      throw new ValidationError('La entidad de transporte debe tener el tipo Empresa de Transporte')
    }
  }

  // R12: entidad relacionada exigida por el tipo de movimiento
  if (tipoMovimiento.entidadRelacionada) {
    if (!body.entidadId) {
      throw new ValidationError(`Este tipo de movimiento exige una entidad de tipo ${tipoMovimiento.entidadRelacionada} (R12)`)
    }
    const entidad = await repo.getEntidadActiva(body.entidadId)
    if (!entidad) throw new ValidationError('La entidad seleccionada no existe o está inactiva')
    if (!entidad.tipos.includes(tipoMovimiento.entidadRelacionada)) {
      throw new ValidationError(`La entidad seleccionada no tiene el tipo ${tipoMovimiento.entidadRelacionada} requerido (R12)`)
    }
  }

  // Artículos: existen y están activos
  const articuloIds = [...new Set(body.detalle.map((d) => d.articuloId))]
  const articulos = await repo.getArticulosPorIds(articuloIds)
  if (articulos.length !== articuloIds.length) {
    throw new ValidationError('Uno o más artículos del movimiento no existen')
  }
  const inactivos = articulos.filter((a) => !a.activo)
  if (inactivos.length > 0) {
    throw new ValidationError(`Artículos inactivos en el movimiento: ${inactivos.map((a) => a.id).join(', ')}`)
  }
  const articulosPorId = new Map(articulos.map((a) => [a.id, { controlaStock: a.controlaStock }]))

  try {
    return await repo.createMovimientoTransaccional(body, clase, articulosPorId, userId)
  } catch (err) {
    if (err instanceof StockInsuficienteError) {
      throw new ValidationError(err.message)
    }
    throw err
  }
}

// ─── Saldos ──────────────────────────────────────────────────────────────────

export async function listarSaldos(filters: { bodegaId?: number; tipo?: string; bajoCritico?: boolean }) {
  return repo.listSaldos(filters)
}

// ─── R15: consulta de stock por receta ──────────────────────────────────────

interface EmbalajeCantidad {
  articuloId: number
  cantidad: number
}

export async function consultarStockReceta(embalajes: EmbalajeCantidad[], bodegaIds: number[]) {
  const embalajeIds = embalajes.map((e) => e.articuloId)
  const recetas = await repo.getRecetasConDetalle(embalajeIds)

  // Expandir demanda por componente (D5): Σ cantidadAConsumir × (cantidadProducir / receta.cantidadAProducir)
  const demandaPorComponente = new Map<number, {
    articuloId: number
    codigo: string
    descripcion: string
    demanda: number
    tipo: string
    controlaStock: boolean
    stockCritico: number | null
  }>()

  for (const embalaje of embalajes) {
    const recetasDelEmbalaje = recetas.filter((r) => r.embalajeId === embalaje.articuloId)
    for (const receta of recetasDelEmbalaje) {
      const factor = embalaje.cantidad / Number(receta.cantidadAProducir)
      for (const linea of receta.detalle) {
        const demandaLinea = Number(linea.cantidadAConsumir) * factor
        const existente = demandaPorComponente.get(linea.componenteId)
        if (existente) {
          existente.demanda += demandaLinea
        } else {
          demandaPorComponente.set(linea.componenteId, {
            articuloId: linea.componenteId,
            codigo: linea.componente.codigo,
            descripcion: linea.componente.descripcion,
            demanda: demandaLinea,
            tipo: linea.componente.tipo,
            controlaStock: linea.componente.controlaStock,
            stockCritico: linea.componente.stockCritico != null ? Number(linea.componente.stockCritico) : null,
          })
        }
      }
    }
  }

  const componenteIds = [...demandaPorComponente.keys()]
  const saldos = componenteIds.length > 0 ? await repo.getSaldosPorArticulos(componenteIds) : []

  return componenteIds.map((articuloId) => {
    const info = demandaPorComponente.get(articuloId)!
    const saldosDelArticulo = saldos.filter((s) => s.articuloId === articuloId)
    const stockPorBodega = saldosDelArticulo.map((s) => ({
      bodegaId: s.bodegaId,
      bodega: s.bodega,
      cantidad: Number(s.cantidad),
    }))
    const stockTotal = stockPorBodega.reduce((acc, s) => acc + s.cantidad, 0)
    const stockSel = bodegaIds.length > 0
      ? stockPorBodega.filter((s) => bodegaIds.includes(s.bodegaId)).reduce((acc, s) => acc + s.cantidad, 0)
      : stockTotal
    const critico = info.stockCritico ?? 0

    let estado: 'NA' | 'OK' | 'WARNING' | 'DANGER'
    const motivos: string[] = []

    if (!info.controlaStock) {
      estado = 'NA'
    } else if (stockTotal < info.demanda) {
      estado = 'DANGER'
      motivos.push('Sin Stock')
    } else {
      if ((stockTotal - info.demanda) < critico) motivos.push('Stock Crítico')
      if (bodegaIds.length > 0 && stockSel < info.demanda) motivos.push('Trasladar')
      estado = motivos.length > 0 ? 'WARNING' : 'OK'
    }

    return {
      articuloId,
      codigo: info.codigo,
      descripcion: info.descripcion,
      demanda: info.demanda,
      stockTotal,
      stockPorBodega,
      estado,
      motivos,
    }
  })
}
