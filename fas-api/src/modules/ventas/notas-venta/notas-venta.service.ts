import { Prisma } from '@prisma/client'
import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './notas-venta.repository.js'
import type { NotaVentaCreateInput, NotaVentaDetalleCreateInput, NotaVentaUpdateInput } from './notas-venta.types.js'

const TIPOS_CLIENTE = new Set(['CLIENTE_NACIONAL', 'CLIENTE_EXTRANJERO'])

interface ReferenciasHeader {
  clienteId: number
  compradorId?: number | null
  notifyId?: number | null
  clienteFinalId?: number | null
  tipoEmbarqueId: number
  mercadoId: number
  paisDestinoId: number
  puertoDestinoId?: number | null
  direccionId?: number | null
  monedaId: number
}

// NV-IE-004: valida existencia + vigencia (no eliminado/bloqueado) de cada
// referencia del encabezado, y consistencia cruzada (dirección↔cliente,
// puerto↔país/tipo de embarque). No valida modalidadVenta/clausulaVenta/
// tipoFlete/formaPago/saldoPago: referencian Parametro genérico sin
// TipoParametro dado de alta todavía (ver comentario en schema.prisma).
async function validarReferenciasHeader(r: ReferenciasHeader) {
  const entidadIds = [r.clienteId, r.compradorId, r.notifyId, r.clienteFinalId].filter(
    (v): v is number => v != null,
  )
  const entidades = await repo.getEntidadTipos(entidadIds)
  const encontrados = new Map(entidades.map((e) => [e.id, e]))
  const faltantes = entidadIds.filter((id) => !encontrados.has(id))
  if (faltantes.length > 0) {
    throw new ValidationError(
      `Una o más entidades (cliente/comprador/notify/cliente final) no existen o están inactivas: ${faltantes.join(', ')}`,
    )
  }
  const cliente = encontrados.get(r.clienteId)
  if (cliente && !cliente.tipos.some((t) => TIPOS_CLIENTE.has(t))) {
    throw new ValidationError('La entidad seleccionada como cliente no tiene tipo Cliente Nacional/Extranjero')
  }

  const [tipoEmbarque, mercado, paisDestino, moneda] = await Promise.all([
    repo.getTipoEmbarque(r.tipoEmbarqueId),
    repo.getMercado(r.mercadoId),
    repo.getPais(r.paisDestinoId),
    repo.getMoneda(r.monedaId),
  ])
  if (!tipoEmbarque) throw new ValidationError('El tipo de embarque seleccionado no existe o está bloqueado')
  if (!mercado) throw new ValidationError('El mercado seleccionado no existe o está bloqueado')
  if (!paisDestino) throw new ValidationError('El país destino seleccionado no existe o está bloqueado')
  if (!moneda) throw new ValidationError('La moneda seleccionada no existe o está bloqueada')

  if (r.puertoDestinoId != null) {
    const puerto = await repo.getPuerto(r.puertoDestinoId)
    if (!puerto) throw new ValidationError('El puerto destino seleccionado no existe o está bloqueado')
    if (puerto.paisId !== r.paisDestinoId) {
      throw new ValidationError('El puerto destino no pertenece al país destino seleccionado')
    }
    if (puerto.tipoEmbarqueId !== r.tipoEmbarqueId) {
      throw new ValidationError('El puerto destino no corresponde al tipo de embarque seleccionado')
    }
  }

  if (r.direccionId != null) {
    const direccion = await repo.getDireccion(r.direccionId)
    if (!direccion) throw new ValidationError('La dirección seleccionada no existe')
    if (direccion.entidadId !== r.clienteId) {
      throw new ValidationError('La dirección seleccionada no pertenece al cliente')
    }
  }
}

async function validarDetalle(data: NotaVentaDetalleCreateInput) {
  const especie = await repo.getEspecie(data.especieId)
  if (!especie) throw new ValidationError('La especie seleccionada no existe o está bloqueada')

  const articulo = await repo.getArticuloTipo(data.articuloId)
  if (!articulo) throw new ValidationError('El artículo de embalaje seleccionado no existe')
  if (articulo.tipo !== 'EMBALAJE') {
    throw new ValidationError('El artículo de la línea debe ser de tipo Embalaje')
  }
  if (!articulo.activo) throw new ValidationError('El artículo de embalaje seleccionado está inactivo')

  const variedad = await repo.getVariedad(data.variedadId)
  if (!variedad) throw new ValidationError('La variedad seleccionada no existe o está bloqueada')
  if (variedad.especieId !== data.especieId) {
    throw new ValidationError('La variedad seleccionada no pertenece a la especie de la línea')
  }

  if (data.categoriaId != null) {
    const categoria = await repo.getCategoria(data.categoriaId)
    if (!categoria) throw new ValidationError('La categoría seleccionada no existe o está bloqueada')
    if (categoria.especieId !== data.especieId) {
      throw new ValidationError('La categoría seleccionada no pertenece a la especie de la línea')
    }
  }

  if (data.tipoPalletId != null) {
    const tipoPallet = await repo.getTipoPallet(data.tipoPalletId)
    if (!tipoPallet) throw new ValidationError('El tipo de pallet seleccionado no existe o está bloqueado')
  }

  const calibres = await repo.getCalibres(data.calibreIds)
  if (calibres.length !== data.calibreIds.length) {
    throw new ValidationError('Uno o más calibres seleccionados no existen o están bloqueados')
  }
  const calibresInvalidos = calibres.filter((c) => c.especieId !== data.especieId)
  if (calibresInvalidos.length > 0) {
    throw new ValidationError('Uno o más calibres seleccionados no pertenecen a la especie de la línea')
  }
}

// Las FK a mantenedores/entidades opcionales (comprador, notify, dirección, etc.)
// no se validan una a una: se deja que la restricción de BD las rechace y se
// traduce a un error de negocio tipado (evita listar ~15 checks de existencia).
async function ejecutarConFkTraducida<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      throw new ValidationError('Una o más referencias (cliente, mercado, país, moneda, etc.) no son válidas')
    }
    throw err
  }
}

export async function listarNotasVenta(page: number, limit: number, clienteId?: number) {
  const { data, total } = await repo.listNotasVenta(page, limit, clienteId)
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function obtenerNotaVenta(id: number) {
  const notaVenta = await repo.getNotaVentaById(id)
  if (!notaVenta) throw new NotFoundError('Nota de Venta', String(id))
  return notaVenta
}

export async function crearNotaVenta(body: NotaVentaCreateInput, creadoPor: string) {
  await validarReferenciasHeader(body)
  return ejecutarConFkTraducida(() => repo.createNotaVenta(body, creadoPor))
}

export async function actualizarNotaVenta(id: number, body: NotaVentaUpdateInput, actualizadoPor: string) {
  const existente = await obtenerNotaVenta(id)

  // Instructivo de Embalaje (compras.md) no bloquea edición/borrado de la
  // Nota de Venta: es un documento independiente, sin relación de herencia
  // definida (a diferencia del Instructivo de Embarque de ventas.md R3/R4,
  // que sí bloquearía — pero ese módulo [Embarque] no está implementado).
  const efectivo: ReferenciasHeader = {
    clienteId: body.clienteId ?? existente.clienteId,
    compradorId: body.compradorId !== undefined ? body.compradorId : existente.compradorId,
    notifyId: body.notifyId !== undefined ? body.notifyId : existente.notifyId,
    clienteFinalId: body.clienteFinalId !== undefined ? body.clienteFinalId : existente.clienteFinalId,
    tipoEmbarqueId: body.tipoEmbarqueId ?? existente.tipoEmbarqueId,
    mercadoId: body.mercadoId ?? existente.mercadoId,
    paisDestinoId: body.paisDestinoId ?? existente.paisDestinoId,
    puertoDestinoId: body.puertoDestinoId !== undefined ? body.puertoDestinoId : existente.puertoDestinoId,
    direccionId: body.direccionId !== undefined ? body.direccionId : existente.direccionId,
    monedaId: body.monedaId ?? existente.monedaId,
  }
  await validarReferenciasHeader(efectivo)

  return ejecutarConFkTraducida(() => repo.updateNotaVenta(id, body, actualizadoPor))
}

export async function eliminarNotaVenta(id: number, eliminadoPor: string) {
  await obtenerNotaVenta(id)
  await repo.softDeleteNotaVenta(id, eliminadoPor)
}

export async function agregarDetalle(notaVentaId: number, body: NotaVentaDetalleCreateInput) {
  await obtenerNotaVenta(notaVentaId)
  await validarDetalle(body)
  return repo.addDetalle(notaVentaId, body)
}
