import { Prisma } from '@prisma/client'
import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './notas-venta.repository.js'
import type { NotaVentaCreateInput, NotaVentaDetalleCreateInput, NotaVentaDetalleUpdateInput, NotaVentaUpdateInput } from './notas-venta.types.js'

const TIPOS_CLIENTE = new Set(['CLIENTE_NACIONAL', 'CLIENTE_EXTRANJERO'])

// R4 (Docs/ventas.md): campos que se heredan y quedan bloqueados una vez
// asociado un Embarque a la NV. Comparación por clave/label — el valor no
// necesita cambiar realmente para listar el campo, la función de abajo ya
// filtra por diferencia real.
const CAMPOS_HEREDADOS_R4: { campo: keyof NotaVentaUpdateInput; label: string }[] = [
  { campo: 'clienteId', label: 'Cliente' },
  { campo: 'tipoEmbarqueId', label: 'Tipo de Embarque' },
  { campo: 'mercadoId', label: 'Mercado' },
  { campo: 'paisDestinoId', label: 'País Destino' },
  { campo: 'puertoDestinoId', label: 'Puerto Destino' },
  { campo: 'compradorContactoId', label: 'Comprador' },
  { campo: 'notifyId', label: 'Notify' },
  { campo: 'direccionId', label: 'Dirección' },
  { campo: 'direccionDetalle', label: 'Detalle de Dirección' },
  { campo: 'tipoFleteId', label: 'Tipo de Flete' },
  { campo: 'clausulaVentaId', label: 'Cláusula de Venta' },
  { campo: 'monedaId', label: 'Moneda' },
]

interface ReferenciasHeader {
  clienteId: number
  compradorContactoId?: number | null
  notifyId?: number | null
  consignatarioId?: number | null
  tipoEmbarqueId: number
  mercadoId: number
  paisDestinoId: number
  puertoDestinoId?: number | null
  direccionId?: number | null
  monedaId: number
  modalidadVentaId?: number | null
  clausulaVentaId?: number | null
  tipoFleteId?: number | null
  condicionPagoId?: number | null
}

// NV-IE-004: valida existencia + vigencia (no eliminado/bloqueado) de cada
// referencia del encabezado, y consistencia cruzada (dirección↔cliente,
// puerto↔país/tipo de embarque).
async function validarReferenciasHeader(r: ReferenciasHeader) {
  const entidadIds = [r.clienteId, r.notifyId, r.consignatarioId].filter(
    (v): v is number => v != null,
  )
  const entidades = await repo.getEntidadTipos(entidadIds)
  const encontrados = new Map(entidades.map((e) => [e.id, e]))
  const faltantes = entidadIds.filter((id) => !encontrados.has(id))
  if (faltantes.length > 0) {
    throw new ValidationError(
      `Una o más entidades (cliente/notify/consignatario) no existen o están inactivas: ${faltantes.join(', ')}`,
    )
  }
  const cliente = encontrados.get(r.clienteId)
  if (cliente && !cliente.tipos.some((t) => TIPOS_CLIENTE.has(t))) {
    throw new ValidationError('La entidad seleccionada como cliente no tiene tipo Cliente Nacional/Extranjero')
  }
  // Supersesión 2026-08-13: antes "Cliente Final" sin validar tipo — ahora
  // exige CONSIGNATARIO, mismo criterio que el cliente.
  if (r.consignatarioId != null) {
    const consignatario = encontrados.get(r.consignatarioId)
    if (consignatario && !consignatario.tipos.includes('CONSIGNATARIO')) {
      throw new ValidationError('La entidad seleccionada como consignatario no tiene tipo Consignatario')
    }
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

  // NV-IE-009: el país destino debe pertenecer al mercado seleccionado, para
  // la empresa activa (Fase 2b: MercadoPais, ya no un FK directo país->mercado).
  if (paisDestino && !(await repo.paisPerteneceAMercado(r.paisDestinoId, r.mercadoId))) {
    throw new ValidationError('El país destino no pertenece al mercado seleccionado')
  }

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

  if (r.compradorContactoId != null) {
    const contacto = await repo.getContactoDeEntidad(r.compradorContactoId, r.clienteId)
    if (!contacto) throw new ValidationError('El comprador (contacto) seleccionado no pertenece al cliente')
  }

  if (r.modalidadVentaId != null) {
    const modalidadVenta = await repo.getParametro(r.modalidadVentaId, 'MODALIDAD_VENTA')
    if (!modalidadVenta) throw new ValidationError('La modalidad de venta seleccionada no existe o está bloqueada')
  }

  if (r.clausulaVentaId != null) {
    const clausulaVenta = await repo.getParametro(r.clausulaVentaId, 'INCOTERM')
    if (!clausulaVenta) throw new ValidationError('La cláusula de venta (Incoterm) seleccionada no existe o está bloqueada')
  }

  if (r.tipoFleteId != null) {
    const tipoFlete = await repo.getParametro(r.tipoFleteId, 'TIPO_FLETE')
    if (!tipoFlete) throw new ValidationError('El tipo de flete seleccionado no existe o está bloqueado')
  }

  if (r.condicionPagoId != null) {
    const condicionPago = await repo.getCondicionPago(r.condicionPagoId)
    if (!condicionPago) throw new ValidationError('La forma de pago (condición de pago) seleccionada no existe o está bloqueada')
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

  const calibres = await repo.getCalibresActivos(data.calibreIds)
  if (calibres.length !== new Set(data.calibreIds).size) {
    throw new ValidationError('Uno o más calibres seleccionados no existen o están bloqueados')
  }
  if (calibres.some((c) => c.especieId !== data.especieId)) {
    throw new ValidationError('Uno o más calibres no pertenecen a la especie de la línea')
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
  // definida. El Instructivo de Embarque (ventas.md R3/R4) sí bloquea — el
  // módulo Embarque tiene una versión mínima implementada (id, notaVentaId,
  // numeroInstructivo) que ya sostiene "Generar Embarque"; el folio
  // autogenerado (R10, 2026-08-13) usa el Tipo de Embarque de la NV en ese
  // momento, así que dejar sin bloquear estos campos podía dejar el folio
  // ya emitido con un prefijo que ya no correspondía (IMP-QA-R1-004).
  const embarques = await repo.countEmbarques(id)
  if (embarques > 0) {
    const camposModificados = CAMPOS_HEREDADOS_R4.filter(
      ({ campo }) => body[campo] !== undefined && body[campo] !== existente[campo],
    )
    if (camposModificados.length > 0) {
      throw new ValidationError(
        `No se puede modificar ${camposModificados.map((c) => c.label).join(', ')}: este Cierre Comercial ya tiene un Embarque asociado (campos heredados, ventas.md R4).`,
      )
    }
  }

  const efectivo: ReferenciasHeader = {
    clienteId: body.clienteId ?? existente.clienteId,
    compradorContactoId: body.compradorContactoId !== undefined ? body.compradorContactoId : existente.compradorContactoId,
    notifyId: body.notifyId !== undefined ? body.notifyId : existente.notifyId,
    consignatarioId: body.consignatarioId !== undefined ? body.consignatarioId : existente.consignatarioId,
    tipoEmbarqueId: body.tipoEmbarqueId ?? existente.tipoEmbarqueId,
    mercadoId: body.mercadoId ?? existente.mercadoId,
    paisDestinoId: body.paisDestinoId ?? existente.paisDestinoId,
    puertoDestinoId: body.puertoDestinoId !== undefined ? body.puertoDestinoId : existente.puertoDestinoId,
    direccionId: body.direccionId !== undefined ? body.direccionId : existente.direccionId,
    monedaId: body.monedaId ?? existente.monedaId,
    modalidadVentaId: body.modalidadVentaId !== undefined ? body.modalidadVentaId : existente.modalidadVentaId,
    clausulaVentaId: body.clausulaVentaId !== undefined ? body.clausulaVentaId : existente.clausulaVentaId,
    tipoFleteId: body.tipoFleteId !== undefined ? body.tipoFleteId : existente.tipoFleteId,
    condicionPagoId: body.condicionPagoId !== undefined ? body.condicionPagoId : existente.condicionPagoId,
  }
  await validarReferenciasHeader(efectivo)

  return ejecutarConFkTraducida(() => repo.updateNotaVenta(id, body, actualizadoPor))
}

export async function eliminarNotaVenta(id: number, eliminadoPor: string) {
  await obtenerNotaVenta(id)
  // R3 (Docs/ventas.md): no se puede eliminar una NV con Embarque asociado.
  const embarques = await repo.countEmbarques(id)
  if (embarques > 0) {
    throw new ValidationError('No se puede eliminar un Cierre Comercial que ya tiene un Embarque asociado')
  }
  await repo.softDeleteNotaVenta(id, eliminadoPor)
}

export async function agregarDetalle(notaVentaId: number, body: NotaVentaDetalleCreateInput) {
  await obtenerNotaVenta(notaVentaId)
  await validarDetalle(body)
  return repo.addDetalle(notaVentaId, body)
}

async function obtenerDetalleDeNotaVenta(notaVentaId: number, detalleId: number) {
  // La Nota de Venta se valida primero vía la consulta tenant-scoped
  // (obtenerNotaVenta) — NotaVentaDetalle no es un modelo tenant, así que sin
  // esto una línea de otra empresa sería alcanzable si el atacante conoce
  // ambos IDs (FAS-EMP-F3-VEN-R1-001).
  await obtenerNotaVenta(notaVentaId)
  const detalle = await repo.getDetalleById(detalleId)
  if (!detalle || detalle.notaVentaId !== notaVentaId) {
    throw new NotFoundError('Línea de detalle', String(detalleId))
  }
}

function calibresIguales(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const setA = new Set(a)
  return b.every((id) => setA.has(id))
}

// Una vez que una línea del Cierre tiene cajas comprometidas por alguna
// OrdenCompraLinea vigente (2026-08-23), especie/variedad/categoría/
// artículo/tipoPallet/calibres quedan bloqueados — esas OC ya copiaron esos
// valores server-side (ordenes-compra.service.ts resolverLineaDesdeCierre) y
// cambiarlos acá los dejaría desincronizados. `cajas` sigue editable, pero
// nunca por debajo de lo ya comprometido.
export async function actualizarDetalle(notaVentaId: number, detalleId: number, body: NotaVentaDetalleUpdateInput) {
  await obtenerDetalleDeNotaVenta(notaVentaId, detalleId)
  const comprometido = await repo.getCajasComprometidas(detalleId)
  if (comprometido > 0) {
    const actual = await repo.getDetalleParaComparar(detalleId)
    if (!actual) throw new NotFoundError('Línea de detalle', String(detalleId))
    const calibresActuales = actual.calibres.map((c) => c.calibreId)
    const cambiaIdentidad =
      body.especieId !== actual.especieId ||
      body.variedadId !== actual.variedadId ||
      (body.categoriaId ?? null) !== actual.categoriaId ||
      body.articuloId !== actual.articuloId ||
      (body.tipoPalletId ?? null) !== actual.tipoPalletId ||
      !calibresIguales(body.calibreIds, calibresActuales)
    if (cambiaIdentidad) {
      throw new ValidationError(
        'No se puede modificar especie, variedad, categoría, artículo, tipo de pallet o calibres: esta línea ya tiene cajas comprometidas por una Orden de Compra',
      )
    }
    if (body.cajas < comprometido) {
      throw new ValidationError(`No se pueden reducir las cajas por debajo de lo ya comprometido por Orden de Compra (${comprometido})`)
    }
  }
  await validarDetalle(body)
  return repo.updateDetalle(detalleId, body)
}

export async function eliminarDetalle(notaVentaId: number, detalleId: number) {
  await obtenerDetalleDeNotaVenta(notaVentaId, detalleId)
  const comprometido = await repo.getCajasComprometidas(detalleId)
  if (comprometido > 0) {
    throw new ValidationError('No se puede eliminar una línea del Cierre Comercial que ya tiene cajas comprometidas por una Orden de Compra')
  }
  await repo.removeDetalle(detalleId, notaVentaId)
}
