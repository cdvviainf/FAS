import { Prisma } from '@prisma/client'
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

  const calibres = await repo.getCalibresActivos(linea.calibreIds)
  if (calibres.length !== new Set(linea.calibreIds).size) {
    throw new ValidationError(`${prefijo} uno o más calibres seleccionados no existen o están bloqueados`)
  }
  if (calibres.some((c) => c.especieId !== linea.especieId)) {
    throw new ValidationError(`${prefijo} uno o más calibres no pertenecen a la especie seleccionada`)
  }

  if (linea.tipoPalletId != null) {
    const tipoPallet = await repo.getTipoPallet(linea.tipoPalletId)
    if (!tipoPallet) throw new ValidationError(`${prefijo} el tipo de pallet seleccionado no existe o está bloqueado`)
  }
}

// Pre-check amigable (2026-08-23) — lectura NO bloqueada, solo para devolver
// un mensaje de error rápido antes de entrar a la transacción. Valida: que la
// línea pertenezca al mismo Cierre de la OC, que tenga categoría definida
// (OrdenCompraLinea la exige; NotaVentaDetalle no), que los calibres pedidos
// sean subconjunto de los de la línea, y que las cajas pedidas no superen el
// disponible. NO es la fuente de verdad: especie/variedad/categoría/
// artículo/tipoPallet que devuelve acá pueden quedar obsoletos si Ventas edita
// la línea del Cierre en el hueco antes de que la transacción tome el lock —
// la autoridad real (que ignora este resultado y vuelve a resolver todo desde
// cero bajo lock) vive en ordenes-compra.repository.ts
// (resolverLineaCierreBajoLock, FAS-OCNV-001/FAS-OCNV-004, QA ronda 2/arbitraje).
async function resolverLineaDesdeCierre(
  notaVentaIdOrden: number | null | undefined,
  notaVentaDetalleId: number,
  linea: OrdenCompraLineaInput,
  index: number,
  excluirLineaId?: number,
): Promise<OrdenCompraLineaInput> {
  const prefijo = `Línea ${index + 1}:`
  if (notaVentaIdOrden == null) {
    throw new ValidationError(`${prefijo} la Orden de Compra no tiene un Cierre Comercial asociado`)
  }
  const detalle = await repo.getNotaVentaDetalle(notaVentaDetalleId)
  if (!detalle) throw new ValidationError(`${prefijo} la línea de Cierre Comercial seleccionada no existe`)
  if (detalle.notaVentaId !== notaVentaIdOrden) {
    throw new ValidationError(`${prefijo} la línea seleccionada no pertenece al Cierre Comercial de esta Orden de Compra`)
  }
  if (detalle.categoriaId == null) {
    throw new ValidationError(`${prefijo} la línea del Cierre Comercial no tiene categoría definida — no se puede usar para una Orden de Compra`)
  }
  const calibresPermitidos = new Set(detalle.calibres.map((c) => c.calibreId))
  if (linea.calibreIds.some((id) => !calibresPermitidos.has(id))) {
    throw new ValidationError(`${prefijo} uno o más calibres no están permitidos por la línea del Cierre Comercial`)
  }
  const comprometido = await repo.getCajasComprometidas(notaVentaDetalleId, excluirLineaId)
  const disponible = detalle.cajas - comprometido
  if (linea.cajas > disponible) {
    throw new ValidationError(`${prefijo} la línea de Cierre Comercial solo tiene ${disponible} caja(s) disponible(s) (solicitadas: ${linea.cajas})`)
  }
  return {
    ...linea,
    especieId: detalle.especieId,
    variedadId: detalle.variedadId,
    categoriaId: detalle.categoriaId,
    articuloId: detalle.articuloId,
    tipoPalletId: detalle.tipoPalletId,
  }
}

async function validarReferenciasHeader(data: {
  entidadProductorId?: number
  notaVentaId?: number | null
  solicitudInspeccionIds?: number[]
  monedaId?: number
  formaPagoId?: number | null
  destinoMercadoId?: number | null
  condicionPagoId?: number | null
  responsableId?: string | null
  incotermId?: number | null
}, vigente?: { entidadProductorId?: number; solicitudInspeccionIds?: number[]; ordenCompraId?: number }) {
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
  // Efectivos: si el PATCH no reenvía el campo, se usa el valor ya guardado
  // en la OC — así un cambio de productor sin reenviar las inspecciones (o
  // viceversa) sigue revalidando que correspondan entre sí (QA-R1-OC-001).
  const productorIdEfectivo = data.entidadProductorId ?? vigente?.entidadProductorId
  const solicitudInspeccionIdsEfectivos = data.solicitudInspeccionIds ?? vigente?.solicitudInspeccionIds
  if (solicitudInspeccionIdsEfectivos != null && solicitudInspeccionIdsEfectivos.length > 0) {
    const solicitudes = await repo.getSolicitudesInspeccion(solicitudInspeccionIdsEfectivos)
    const encontradosIds = new Set(solicitudes.map((s) => s.id))
    if (solicitudInspeccionIdsEfectivos.some((id) => !encontradosIds.has(id))) {
      throw new ValidationError('Una o más inspecciones de compra seleccionadas no existen')
    }
    if (productorIdEfectivo != null && solicitudes.some((s) => s.entidadProductorId !== productorIdEfectivo)) {
      throw new ValidationError('Una o más inspecciones de compra seleccionadas no corresponden al productor de esta Orden de Compra')
    }
    // N:M (2026-08-22, Etapa 2): ya no exige que TODAS estén Aprobadas —
    // basta con que al menos una lo esté para habilitar la OC.
    if (!solicitudes.some((s) => s.estado === 'APROBADA')) {
      throw new ValidationError('Al menos una de las inspecciones de compra seleccionadas debe estar Aprobada')
    }
    // "Ya vinculada a otra OC" solo se revalida cuando el propio caller
    // reenvía el arreglo — si llegó solo por el fallback `vigente`, ya está
    // vinculada a ESTA misma OC y no corresponde chocar contra sí misma.
    if (data.solicitudInspeccionIds != null) {
      const yaVinculadas = await repo.getSolicitudesYaVinculadas(data.solicitudInspeccionIds, vigente?.ordenCompraId)
      if (yaVinculadas.length > 0) {
        throw new ValidationError('Una o más inspecciones de compra seleccionadas ya están vinculadas a otra Orden de Compra')
      }
    }
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
  if (data.incotermId != null) {
    const incoterm = await repo.getParametro(data.incotermId, 'INCOTERM')
    if (!incoterm) throw new ValidationError('El Incoterm seleccionado no existe o está bloqueado')
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
  // La columna se eliminó (tabla puente N:M, Etapa 2), así que la
  // obligatoriedad de al menos 1 solicitud al crear vive acá, no solo en el
  // schema Zod: cualquier caller directo del service (incluidos los tests)
  // debe cumplirla igual que el HTTP (QA-R1-TEST-001).
  if (!body.solicitudInspeccionIds || body.solicitudInspeccionIds.length === 0) {
    throw new ValidationError('La inspección de compra es requerida')
  }
  await validarReferenciasHeader(body)
  try {
    return await repo.createOrdenCompra(body, creadoPor)
  } catch (e) {
    throw traducirColisionSolicitud(e)
  }
}

// Carrera concurrente (FAS-OCSI-004, QA ronda 2): dos creaciones/ediciones
// simultáneas pueden pasar ambas el pre-check de "ya vinculada" en
// validarReferenciasHeader antes de que cualquiera confirme — el índice
// único de la tabla puente es la última defensa; esto solo traduce ese
// empate de reloj a un 422 de negocio (mismo patrón que agregarFolios,
// Etapa 1A).
function traducirColisionSolicitud(e: unknown): unknown {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return new ValidationError('Una o más inspecciones de compra seleccionadas ya están vinculadas a otra Orden de Compra (carga simultánea)')
  }
  return e
}

export async function actualizarOrdenCompra(id: number, body: OrdenCompraUpdateInput, actualizadoPor: string) {
  const existente = await obtenerOrdenCompra(id)
  // Editable hasta Recepción (compras.md §6.2/§8): una vez recepcionada
  // (asignado por el futuro flujo de Recepción, no por este endpoint) la OC
  // queda bloqueada.
  if (existente.estado === 'RECEPCIONADA') {
    throw new ValidationError('La Orden de Compra ya fue recepcionada y no puede editarse')
  }
  // FAS-OCNV-001 (QA ronda 1): no se puede cambiar ni quitar el Cierre
  // Comercial de la OC mientras tenga líneas tomadas de él — quedarían
  // huérfanas (notaVentaDetalleId apuntando a un Cierre que la OC ya no dice
  // tener). Pre-check amigable, no bloqueado — la autoridad real vuelve a
  // chequear esto bajo el mismo lock que addLinea/updateLinea (ver
  // ordenes-compra.repository.ts updateOrdenCompra).
  if (body.notaVentaId !== undefined && body.notaVentaId !== existente.notaVentaId) {
    if (existente.lineas.some((l) => l.notaVentaDetalleId != null)) {
      throw new ValidationError(
        'No se puede cambiar el Cierre Comercial de la Orden de Compra: tiene líneas tomadas de un Cierre Comercial — elimínelas primero',
      )
    }
  }
  await validarReferenciasHeader(body, {
    entidadProductorId: existente.entidadProductorId,
    solicitudInspeccionIds: existente.solicitudes.map((s) => s.solicitudInspeccion.id),
    ordenCompraId: id,
  })
  try {
    return await repo.updateOrdenCompra(id, body, actualizadoPor)
  } catch (e) {
    throw traducirColisionSolicitud(e)
  }
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
  const lineaResuelta = body.notaVentaDetalleId != null
    ? await resolverLineaDesdeCierre(orden.notaVentaId, body.notaVentaDetalleId, body, 0)
    : body
  await validarLinea(lineaResuelta, 0)
  return repo.addLinea(ordenCompraId, { ...lineaResuelta, notaVentaDetalleId: body.notaVentaDetalleId ?? null })
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
  return { orden, linea }
}

export async function actualizarLinea(ordenCompraId: number, lineaId: number, body: OrdenCompraLineaUpdateInput) {
  const { orden, linea } = await obtenerLineaDeOrdenCompra(ordenCompraId, lineaId)
  assertEditable(orden)
  // notaVentaDetalleId es inmutable post-creación (no viene en el
  // UpdateInput) — si la línea ya tenía origen en el Cierre, se sigue
  // revalidando/re-bloqueando contra esa misma línea en cada edición.
  const lineaResuelta = linea.notaVentaDetalleId != null
    ? await resolverLineaDesdeCierre(orden.notaVentaId, linea.notaVentaDetalleId, body, 0, lineaId)
    : body
  await validarLinea(lineaResuelta, 0)
  return repo.updateLinea(ordenCompraId, lineaId, lineaResuelta)
}

export async function eliminarLinea(ordenCompraId: number, lineaId: number) {
  const { orden } = await obtenerLineaDeOrdenCompra(ordenCompraId, lineaId)
  assertEditable(orden)
  await repo.removeLinea(lineaId, ordenCompraId)
}

// Alimenta la grilla del formulario de OC al elegir un Cierre Comercial
// (2026-08-23) — líneas del Cierre con su disponible ya calculado.
export async function obtenerDisponibilidadCierre(notaVentaId: number) {
  const notaVenta = await repo.getNotaVenta(notaVentaId)
  if (!notaVenta) throw new NotFoundError('Cierre Comercial', String(notaVentaId))
  return repo.getNotaVentaDetalleConDisponibilidad(notaVentaId)
}
