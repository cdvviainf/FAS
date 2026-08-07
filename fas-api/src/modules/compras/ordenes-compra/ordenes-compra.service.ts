import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './ordenes-compra.repository.js'
import type {
  OrdenCompraCreateInput,
  OrdenCompraLineaInput,
  OrdenCompraLineaCreateInput,
  OrdenCompraLineaUpdateInput,
  OrdenCompraUpdateInput,
} from './ordenes-compra.types.js'

async function validarLinea(linea: OrdenCompraLineaInput, index: number) {
  const prefijo = `Línea ${index + 1}:`

  const especie = await repo.getEspecie(linea.especieId)
  if (!especie) throw new ValidationError(`${prefijo} la especie seleccionada no existe o está bloqueada`)

  const articulo = await repo.getArticuloTipo(linea.articuloId)
  if (!articulo) throw new ValidationError(`${prefijo} el artículo de embalaje seleccionado no existe`)
  if (articulo.tipo !== 'EMBALAJE') throw new ValidationError(`${prefijo} el artículo debe ser de tipo Embalaje`)
  if (!articulo.activo) throw new ValidationError(`${prefijo} el artículo de embalaje seleccionado está inactivo`)

  const variedad = await repo.getVariedad(linea.variedadId)
  if (!variedad) throw new ValidationError(`${prefijo} la variedad seleccionada no existe o está bloqueada`)
  if (variedad.especieId !== linea.especieId) {
    throw new ValidationError(`${prefijo} la variedad no pertenece a la especie seleccionada`)
  }

  const categoria = await repo.getCategoria(linea.categoriaId)
  if (!categoria) throw new ValidationError(`${prefijo} la categoría seleccionada no existe o está bloqueada`)
  if (categoria.especieId !== linea.especieId) {
    throw new ValidationError(`${prefijo} la categoría no pertenece a la especie seleccionada`)
  }

  const [calibreMin, calibreMax] = await Promise.all([
    repo.getCalibre(linea.calibreMinId),
    repo.getCalibre(linea.calibreMaxId),
  ])
  if (!calibreMin || !calibreMax) {
    throw new ValidationError(`${prefijo} uno o ambos calibres del rango no existen o están bloqueados`)
  }
  if (calibreMin.especieId !== linea.especieId || calibreMax.especieId !== linea.especieId) {
    throw new ValidationError(`${prefijo} el rango de calibre no pertenece a la especie seleccionada`)
  }
  // Maestro de Calibres ordenado por especie (Docs/compras.md §6.5).
  if (calibreMin.orden > calibreMax.orden) {
    throw new ValidationError(`${prefijo} el calibre mínimo debe preceder (o igualar) al calibre máximo en el orden del maestro`)
  }

  if (linea.tipoPalletId != null) {
    const tipoPallet = await repo.getTipoPallet(linea.tipoPalletId)
    if (!tipoPallet) throw new ValidationError(`${prefijo} el tipo de pallet seleccionado no existe o está bloqueado`)
  }
}

async function validarReferenciasHeader(data: {
  entidadProductorId?: number
  notaVentaId?: number | null
  monedaId?: number
  formaPagoId?: number | null
  destinoMercadoId?: number | null
  condicionPagoId?: number | null
  responsableId?: string | null
}) {
  if (data.entidadProductorId != null) {
    const productor = await repo.getEntidadProductor(data.entidadProductorId)
    if (!productor) throw new ValidationError('El productor seleccionado no existe o está inactivo')
    if (!productor.tipos.includes('PRODUCTOR')) {
      throw new ValidationError('La entidad seleccionada no tiene tipo Productor')
    }
  }
  if (data.monedaId != null) {
    const moneda = await repo.getMoneda(data.monedaId)
    if (!moneda) throw new ValidationError('La moneda seleccionada no existe o está bloqueada')
  }
  if (data.notaVentaId != null) {
    const notaVenta = await repo.getNotaVenta(data.notaVentaId)
    if (!notaVenta) throw new ValidationError('El Cierre Comercial (Nota de Venta) seleccionado no existe')
  }
  if (data.formaPagoId != null) {
    const formaPago = await repo.getFormaPago(data.formaPagoId)
    if (!formaPago) throw new ValidationError('La forma de pago seleccionada no existe o está bloqueada')
  }
  if (data.destinoMercadoId != null) {
    const mercado = await repo.getMercado(data.destinoMercadoId)
    if (!mercado) throw new ValidationError('El destino (mercado) seleccionado no existe o está bloqueado')
  }
  if (data.condicionPagoId != null) {
    const condicionPago = await repo.getCondicionPago(data.condicionPagoId)
    if (!condicionPago) throw new ValidationError('La condición de pago seleccionada no existe o está bloqueada')
  }
  if (data.responsableId != null) {
    const responsable = await repo.getUsuarioResponsable(data.responsableId)
    if (!responsable) throw new ValidationError('El responsable seleccionado no existe o no está marcado como Responsable de Venta')
  }
}

export async function listarOrdenesCompra(page: number, limit: number, entidadProductorId?: number, estado?: string) {
  const { data, total } = await repo.listOrdenesCompra(page, limit, entidadProductorId, estado)
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function obtenerOrdenCompra(id: number) {
  const orden = await repo.getOrdenCompraById(id)
  if (!orden) throw new NotFoundError('Orden de Compra', String(id))
  return orden
}

export async function crearOrdenCompra(body: OrdenCompraCreateInput, creadoPor: string) {
  await validarReferenciasHeader(body)
  return repo.createOrdenCompra(body, creadoPor)
}

export async function actualizarOrdenCompra(id: number, body: OrdenCompraUpdateInput, actualizadoPor: string) {
  const existente = await obtenerOrdenCompra(id)
  // Editable hasta Recepción (compras.md §6.2/§8): una vez recepcionada
  // (asignado por el futuro flujo de Recepción, no por este endpoint) la OC
  // queda bloqueada.
  if (existente.estado === 'RECEPCIONADA') {
    throw new ValidationError('La Orden de Compra ya fue recepcionada y no puede editarse')
  }
  await validarReferenciasHeader(body)
  return repo.updateOrdenCompra(id, body, actualizadoPor)
}

export async function eliminarOrdenCompra(id: number, eliminadoPor: string) {
  const existente = await obtenerOrdenCompra(id)
  if (existente.estado === 'RECEPCIONADA') {
    throw new ValidationError('La Orden de Compra ya fue recepcionada y no puede eliminarse')
  }
  await repo.softDeleteOrdenCompra(id, eliminadoPor)
}

function assertEditable(orden: { estado: string }) {
  if (orden.estado === 'RECEPCIONADA') {
    throw new ValidationError('La Orden de Compra ya fue recepcionada y no puede editarse')
  }
}

export async function agregarLinea(ordenCompraId: number, body: OrdenCompraLineaCreateInput) {
  const orden = await obtenerOrdenCompra(ordenCompraId)
  assertEditable(orden)
  await validarLinea(body, 0)
  return repo.addLinea(ordenCompraId, body)
}

// La OrdenCompraLinea no es un modelo tenant (tabla hija, decisión #5 de
// empresas.md) — se valida el padre primero vía obtenerOrdenCompra (que sí es
// tenant-scoped) antes de tocar la línea directamente, o una línea de otra
// empresa sería alcanzable conociendo ambos IDs (mismo motivo que
// obtenerDetalleDeNotaVenta en notas-venta.service.ts).
async function obtenerLineaDeOrdenCompra(ordenCompraId: number, lineaId: number) {
  const orden = await obtenerOrdenCompra(ordenCompraId)
  const linea = await repo.getLineaById(lineaId)
  if (!linea || linea.ordenCompraId !== ordenCompraId) {
    throw new NotFoundError('Línea de Orden de Compra', String(lineaId))
  }
  return orden
}

export async function actualizarLinea(ordenCompraId: number, lineaId: number, body: OrdenCompraLineaUpdateInput) {
  const orden = await obtenerLineaDeOrdenCompra(ordenCompraId, lineaId)
  assertEditable(orden)
  await validarLinea(body, 0)
  return repo.updateLinea(lineaId, body)
}

export async function eliminarLinea(ordenCompraId: number, lineaId: number) {
  const orden = await obtenerLineaDeOrdenCompra(ordenCompraId, lineaId)
  assertEditable(orden)
  await repo.removeLinea(lineaId, ordenCompraId)
}
