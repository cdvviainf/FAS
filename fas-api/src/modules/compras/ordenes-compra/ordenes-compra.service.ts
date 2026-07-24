import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './ordenes-compra.repository.js'
import type {
  OrdenCompraCreateInput,
  OrdenCompraCuotaPagoInput,
  OrdenCompraLineaInput,
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
}

function validarCuotasPago(cuotas: OrdenCompraCuotaPagoInput[] | undefined) {
  if (!cuotas || cuotas.length === 0) return
  const suma = cuotas.reduce((acc, c) => acc + c.porcentaje, 0)
  if (Math.round(suma * 100) / 100 !== 100) {
    throw new ValidationError(`Las cuotas de pago deben sumar 100% (suma actual: ${suma}%)`)
  }
}

async function validarReferenciasHeader(data: {
  entidadProductorId?: number
  notaVentaId?: number | null
  monedaId?: number
  facturarAId?: number | null
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
  if (data.facturarAId != null) {
    const entidad = await repo.getEntidad(data.facturarAId)
    if (!entidad) throw new ValidationError('La entidad seleccionada para facturar no existe o está inactiva')
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
  validarCuotasPago(body.cuotasPago)
  for (const [index, linea] of body.lineas.entries()) {
    await validarLinea(linea, index)
  }
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
  validarCuotasPago(body.cuotasPago)
  if (body.lineas) {
    for (const [index, linea] of body.lineas.entries()) {
      await validarLinea(linea, index)
    }
  }
  return repo.updateOrdenCompra(id, body, actualizadoPor)
}

export async function eliminarOrdenCompra(id: number, eliminadoPor: string) {
  const existente = await obtenerOrdenCompra(id)
  if (existente.estado === 'RECEPCIONADA') {
    throw new ValidationError('La Orden de Compra ya fue recepcionada y no puede eliminarse')
  }
  await repo.softDeleteOrdenCompra(id, eliminadoPor)
}
