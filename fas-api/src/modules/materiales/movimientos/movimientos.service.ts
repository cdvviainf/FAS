import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './movimientos.repository.js'
import { StockInsuficienteError } from './movimientos.repository.js'
import type { MovimientoCreateInput, MovimientoDetalleInput, MovimientoListFilters, MovimientoUpdateInput } from './movimientos.types.js'

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

function assertBorrador(movimiento: { estado: string }) {
  if (movimiento.estado !== 'BORRADOR') {
    throw new ValidationError('El movimiento ya fue confirmado y no puede editarse')
  }
}

export async function crearMovimiento(body: MovimientoCreateInput, userId: string) {
  // R14: el tipo de movimiento debe aplicar al módulo Materiales. El resto de
  // las validaciones (bodegas, entidad, precio, DTE) se difieren a confirmar
  // — la cabecera nace como borrador editable, sin datos todavía.
  const tipoMovimiento = await repo.getTipoMovimientoActivo(body.tipoMovimientoId)
  if (!tipoMovimiento) throw new ValidationError('El tipo de movimiento no existe o está inactivo')
  if (!tipoMovimiento.modulos.includes('MATERIALES')) {
    throw new ValidationError('Este tipo de movimiento no aplica al módulo Materiales (R14)')
  }
  return repo.createMovimientoBorrador(body, userId)
}

export async function actualizarMovimiento(id: number, body: MovimientoUpdateInput) {
  const movimiento = await obtenerMovimiento(id)
  assertBorrador(movimiento)

  if (body.transporteEntidadId != null) {
    const transportista = await repo.getEntidadActiva(body.transporteEntidadId)
    if (!transportista) throw new ValidationError('La empresa de transporte no existe o está inactiva')
    if (!transportista.tipos.includes('EMPRESA_TRANSPORTE')) {
      throw new ValidationError('La entidad de transporte debe tener el tipo Empresa de Transporte')
    }
  }
  if (body.entidadId != null) {
    const entidad = await repo.getEntidadActiva(body.entidadId)
    if (!entidad) throw new ValidationError('La entidad seleccionada no existe o está inactiva')
    if (movimiento.tipoMovimiento.entidadRelacionada && !entidad.tipos.includes(movimiento.tipoMovimiento.entidadRelacionada)) {
      throw new ValidationError(`La entidad seleccionada no tiene el tipo ${movimiento.tipoMovimiento.entidadRelacionada} requerido (R12)`)
    }
  }
  // Pre-check amigable (materiales.md R22) — la autoridad real vuelve a
  // revalidar esto bajo lock dentro de confirmarMovimientoTransaccional; acá
  // solo evita abrir la transacción de confirmar con un error obvio.
  if (body.ordenCompraMaterialId != null) {
    if (movimiento.tipoMovimiento.clase !== 'ENTRADA') {
      throw new ValidationError('Solo un movimiento de clase Entrada puede vincularse a una Orden de Compra de Materiales (R22)')
    }
    const oc = await repo.getOrdenCompraMaterialActiva(body.ordenCompraMaterialId)
    if (!oc) throw new ValidationError('La Orden de Compra de Materiales seleccionada no existe')
    if (oc.estado !== 'EMITIDA') {
      throw new ValidationError('Solo se puede vincular una Orden de Compra de Materiales EMITIDA (R22)')
    }
  }

  // MOV-002 (QA ronda 1): pre-check amigable — la autoridad real vuelve a
  // chequear esto en confirmarMovimiento contra lo persistido.
  const bodegaOrigenEfectiva = body.bodegaOrigenId !== undefined ? body.bodegaOrigenId : movimiento.bodegaOrigenId
  const bodegaDestinoEfectiva = body.bodegaDestinoId !== undefined ? body.bodegaDestinoId : movimiento.bodegaDestinoId
  if (
    movimiento.tipoMovimiento.clase === 'TRASLADO'
    && bodegaOrigenEfectiva != null
    && bodegaOrigenEfectiva === bodegaDestinoEfectiva
  ) {
    throw new ValidationError('Un movimiento de Traslado no puede tener la misma bodega de origen y destino (R11)')
  }

  try {
    return await repo.updateMovimientoHeader(id, body)
  } catch (e) {
    throw traducirColisionOrdenCompraMaterial(e)
  }
}

// Carrera concurrente (materiales.md R22, mismo patrón que
// traducirColisionSolicitud en compras/ordenes-compra.service.ts): el índice
// parcial `movimientos_ordenCompraMaterialId_activa_key` es la última
// defensa si dos vinculaciones a la misma OC pasan ambas el pre-check antes
// de que cualquiera confirme.
function traducirColisionOrdenCompraMaterial(e: unknown): unknown {
  if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002') {
    return new ValidationError('Ya existe un Movimiento activo vinculado a esa Orden de Compra de Materiales (carga simultánea)')
  }
  return e
}

export async function eliminarMovimiento(id: number, userId: string) {
  const movimiento = await obtenerMovimiento(id)
  assertBorrador(movimiento)
  await repo.softDeleteMovimiento(id, userId)
}

async function validarArticuloDeLinea(articuloId: number) {
  const articulos = await repo.getArticulosPorIds([articuloId])
  if (articulos.length === 0) throw new ValidationError('El artículo seleccionado no existe')
  if (!articulos[0].activo) throw new ValidationError('El artículo seleccionado está inactivo')
}

export async function agregarLinea(movimientoId: number, body: MovimientoDetalleInput) {
  const movimiento = await obtenerMovimiento(movimientoId)
  assertBorrador(movimiento)
  if (movimiento.tipoMovimiento.requierePrecio && body.precioUnitario == null) {
    throw new ValidationError('Este tipo de movimiento exige precio unitario en todas las líneas (R9)')
  }
  await validarArticuloDeLinea(body.articuloId)
  return repo.addLineaDetalle(movimientoId, body)
}

// MovimientoDetalle no es un modelo tenant (tabla hija) — se valida el padre
// primero vía obtenerMovimiento (sí es tenant-scoped) antes de tocar la línea
// directamente, mismo motivo que obtenerLineaDeOrdenCompra en
// ordenes-compra.service.ts.
async function obtenerLineaDeMovimiento(movimientoId: number, detalleId: number) {
  const movimiento = await obtenerMovimiento(movimientoId)
  const linea = await repo.getLineaDetalleById(detalleId)
  if (!linea || linea.movimientoId !== movimientoId) {
    throw new NotFoundError('Línea de Movimiento', String(detalleId))
  }
  return { movimiento, linea }
}

export async function actualizarLinea(movimientoId: number, detalleId: number, body: MovimientoDetalleInput) {
  const { movimiento } = await obtenerLineaDeMovimiento(movimientoId, detalleId)
  assertBorrador(movimiento)
  if (movimiento.tipoMovimiento.requierePrecio && body.precioUnitario == null) {
    throw new ValidationError('Este tipo de movimiento exige precio unitario en todas las líneas (R9)')
  }
  await validarArticuloDeLinea(body.articuloId)
  return repo.updateLineaDetalle(movimientoId, detalleId, body)
}

export async function eliminarLinea(movimientoId: number, detalleId: number) {
  const { movimiento } = await obtenerLineaDeMovimiento(movimientoId, detalleId)
  assertBorrador(movimiento)
  await repo.removeLineaDetalle(movimientoId, detalleId)
}

// Pre-check amigable, NO autoritativo (MOV-003, QA ronda 2): esta lectura
// ocurre antes de adquirir cualquier lock, así que otro request podría mutar
// la cabecera/líneas (o desactivar la entidad/transportista) entre este
// chequeo y la confirmación real. La autoridad vive en
// validarParaConfirmar (movimientos.repository.ts), que repite exactamente
// estas mismas reglas después de adquirir LOCK_NAMESPACE_MOVIMIENTO_PROCESO
// y releer todo desde la base — esto solo evita abrir una transacción para
// un error obvio (mejor UX / mensaje más rápido).
export async function confirmarMovimiento(id: number, userId: string) {
  const movimiento = await obtenerMovimiento(id)
  assertBorrador(movimiento)

  const tipoMovimiento = movimiento.tipoMovimiento
  if (!tipoMovimiento.activo) {
    throw new ValidationError('El tipo de movimiento fue desactivado — no se puede confirmar')
  }
  if (!tipoMovimiento.modulos.includes('MATERIALES')) {
    throw new ValidationError('Este tipo de movimiento no aplica al módulo Materiales (R14)')
  }

  const clase = tipoMovimiento.clase
  if (clase === 'ENTRADA' && !movimiento.bodegaDestinoId) {
    throw new ValidationError('Un movimiento de Entrada requiere bodega de destino (R11)')
  }
  if (clase === 'SALIDA' && !movimiento.bodegaOrigenId) {
    throw new ValidationError('Un movimiento de Salida requiere bodega de origen (R11)')
  }
  if (clase === 'TRASLADO' && (!movimiento.bodegaOrigenId || !movimiento.bodegaDestinoId)) {
    throw new ValidationError('Un movimiento de Traslado requiere bodega de origen y destino (R11)')
  }
  // MOV-002 (QA ronda 1): un traslado origen=destino hace que la segunda
  // escritura del motor (destino) sobreescriba la primera (origen) sobre la
  // misma fila de SaldoArticulo, sumando la cantidad en vez de dejarla igual.
  if (clase === 'TRASLADO' && movimiento.bodegaOrigenId === movimiento.bodegaDestinoId) {
    throw new ValidationError('Un movimiento de Traslado no puede tener la misma bodega de origen y destino (R11)')
  }

  if (movimiento.detalle.length === 0) {
    throw new ValidationError('El movimiento debe tener al menos una línea antes de confirmar')
  }
  if (tipoMovimiento.requierePrecio) {
    const sinPrecio = movimiento.detalle.filter((d) => d.precioUnitario == null)
    if (sinPrecio.length > 0) {
      throw new ValidationError('Este tipo de movimiento exige precio unitario en todas las líneas (R9)')
    }
  }

  if (tipoMovimiento.emiteDTE) {
    const faltantes: string[] = []
    if (!movimiento.transporteEntidadId) faltantes.push('empresa de transporte')
    if (!movimiento.choferRut) faltantes.push('RUT del chofer')
    if (!movimiento.choferNombre) faltantes.push('nombre del chofer')
    if (!movimiento.placaCamion) faltantes.push('placa del camión')
    if (!movimiento.horaSalida) faltantes.push('hora de salida')
    if (faltantes.length > 0) {
      throw new ValidationError(`Este tipo de movimiento emite DTE y requiere: ${faltantes.join(', ')} (R10)`)
    }
    // MOV-003 (QA ronda 1): la cabecera solo se valida al editarla (PATCH) —
    // sin esto, un transportista desactivado/eliminado/reclasificado después
    // de guardar la cabecera igual permitía confirmar.
    const transportista = await repo.getEntidadActiva(movimiento.transporteEntidadId!)
    if (!transportista) throw new ValidationError('La empresa de transporte no existe o está inactiva (R10)')
    if (!transportista.tipos.includes('EMPRESA_TRANSPORTE')) {
      throw new ValidationError('La entidad de transporte debe tener el tipo Empresa de Transporte (R10)')
    }
  }

  if (tipoMovimiento.entidadRelacionada) {
    // materiales.md R22: si el movimiento está vinculado a una Orden de
    // Compra de Materiales y no trae entidadId, la autoridad real
    // (repo.confirmarMovimientoTransaccional) lo copia desde la OC antes de
    // llegar acá — este pre-check amigable no puede anticiparlo sin repetir
    // esa misma lectura, así que solo exige el campo cuando NO hay OC vinculada.
    if (!movimiento.entidadId && movimiento.ordenCompraMaterialId == null) {
      throw new ValidationError(`Este tipo de movimiento exige una entidad de tipo ${tipoMovimiento.entidadRelacionada} (R12)`)
    }
    if (movimiento.entidadId) {
      // MOV-003 (QA ronda 1): mismo motivo que el transportista arriba — revalida
      // el estado actual de la entidad, no solo que el campo esté presente.
      const entidad = await repo.getEntidadActiva(movimiento.entidadId)
      if (!entidad) throw new ValidationError('La entidad seleccionada no existe o está inactiva (R12)')
      if (!entidad.tipos.includes(tipoMovimiento.entidadRelacionada)) {
        throw new ValidationError(`La entidad seleccionada no tiene el tipo ${tipoMovimiento.entidadRelacionada} requerido (R12)`)
      }
    }
  }

  const articuloIds = [...new Set(movimiento.detalle.map((d) => d.articuloId))]
  const articulos = await repo.getArticulosPorIds(articuloIds)
  if (articulos.length !== articuloIds.length) {
    throw new ValidationError('Uno o más artículos del movimiento no existen')
  }
  const inactivos = articulos.filter((a) => !a.activo)
  if (inactivos.length > 0) {
    throw new ValidationError(`Artículos inactivos en el movimiento: ${inactivos.map((a) => a.id).join(', ')}`)
  }

  try {
    return await repo.confirmarMovimientoTransaccional(id)
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
