import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './ordenes-compra.repository.js'
import type {
  OrdenCompraMaterialCreateInput,
  OrdenCompraMaterialLineaCreateInput,
  OrdenCompraMaterialLineaUpdateInput,
  OrdenCompraMaterialUpdateInput,
} from './ordenes-compra.types.js'

async function validarReferenciasHeader(data: {
  entidadProveedorId?: number
  monedaId?: number
  formaPagoId?: number | null
  condicionPagoId?: number | null
}) {
  if (data.entidadProveedorId != null) {
    const proveedor = await repo.getEntidadProveedor(data.entidadProveedorId)
    if (!proveedor) throw new ValidationError('El proveedor seleccionado no existe o está inactivo')
    if (!proveedor.tipos.includes('PROVEEDOR')) {
      throw new ValidationError('La entidad seleccionada no tiene tipo Proveedor (R19)')
    }
  }
  if (data.monedaId != null) {
    const moneda = await repo.getMoneda(data.monedaId)
    if (!moneda) throw new ValidationError('La moneda seleccionada no existe o está bloqueada')
  }
  if (data.formaPagoId != null) {
    const formaPago = await repo.getFormaPago(data.formaPagoId)
    if (!formaPago) throw new ValidationError('La forma de pago seleccionada no existe o está bloqueada')
  }
  if (data.condicionPagoId != null) {
    const condicionPago = await repo.getCondicionPago(data.condicionPagoId)
    if (!condicionPago) throw new ValidationError('La condición de pago seleccionada no existe o está bloqueada')
    if (condicionPago.tipo !== 'COMPRA') {
      throw new ValidationError('La condición de pago debe ser de tipo Compra')
    }
    // R21 (cuota MONTO_UNITARIO no permitida) se revalida bajo lock en el
    // repositorio al construir el snapshot — acá solo el pre-check de
    // existencia/tipo, más rápido de mostrar en el formulario.
  }
}

export async function listarOrdenesCompraMaterial(page: number, limit: number, entidadProveedorId?: number, estado?: string) {
  const { data, total } = await repo.listOrdenesCompraMaterial(page, limit, entidadProveedorId, estado)
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function obtenerOrdenCompraMaterial(id: number) {
  const orden = await repo.getOrdenCompraMaterialById(id)
  if (!orden) throw new NotFoundError('Orden de Compra de Materiales', String(id))
  return orden
}

export async function crearOrdenCompraMaterial(body: OrdenCompraMaterialCreateInput, creadoPor: string) {
  await validarReferenciasHeader(body)
  return repo.createOrdenCompraMaterial(body, creadoPor)
}

export async function actualizarOrdenCompraMaterial(id: number, body: OrdenCompraMaterialUpdateInput, actualizadoPor: string) {
  await obtenerOrdenCompraMaterial(id)
  await validarReferenciasHeader(body)
  return repo.updateOrdenCompraMaterial(id, body, actualizadoPor)
}

export async function emitirOrdenCompraMaterial(id: number) {
  await obtenerOrdenCompraMaterial(id)
  return repo.emitirOrdenCompraMaterial(id)
}

export async function eliminarOrdenCompraMaterial(id: number, eliminadoPor: string) {
  await obtenerOrdenCompraMaterial(id)
  await repo.softDeleteOrdenCompraMaterial(id, eliminadoPor)
}

async function validarArticulo(articuloId: number) {
  const articulo = await repo.getArticuloActivo(articuloId)
  if (!articulo) throw new ValidationError('El artículo seleccionado no existe o está inactivo')
}

export async function agregarLinea(ordenCompraMaterialId: number, body: OrdenCompraMaterialLineaCreateInput) {
  await obtenerOrdenCompraMaterial(ordenCompraMaterialId)
  await validarArticulo(body.articuloId)
  return repo.addLinea(ordenCompraMaterialId, body)
}

async function obtenerLineaDeOrden(ordenCompraMaterialId: number, lineaId: number) {
  await obtenerOrdenCompraMaterial(ordenCompraMaterialId)
  const linea = await repo.getLineaById(lineaId)
  if (!linea || linea.ordenCompraMaterialId !== ordenCompraMaterialId) {
    throw new NotFoundError('Línea de Orden de Compra de Materiales', String(lineaId))
  }
  return linea
}

export async function actualizarLinea(ordenCompraMaterialId: number, lineaId: number, body: OrdenCompraMaterialLineaUpdateInput) {
  await obtenerLineaDeOrden(ordenCompraMaterialId, lineaId)
  await validarArticulo(body.articuloId)
  return repo.updateLinea(ordenCompraMaterialId, lineaId, body)
}

export async function eliminarLinea(ordenCompraMaterialId: number, lineaId: number) {
  await obtenerLineaDeOrden(ordenCompraMaterialId, lineaId)
  await repo.removeLinea(lineaId, ordenCompraMaterialId)
}
