import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { ValidationError } from '../../../shared/errors.js'
import { LOCK_NAMESPACE_NOTA_VENTA_DETALLE } from '../../../shared/advisory-locks.js'
import type { NotaVentaCreateInput, NotaVentaDetalleCreateInput, NotaVentaDetalleUpdateInput, NotaVentaUpdateInput } from './notas-venta.types.js'

const entidadSelect = { id: true, codigo: true, descripcion: true, razonSocial: true }

const includeDetalle = {
  cliente: { select: entidadSelect },
  compradorContacto: { select: { id: true, nombre: true, email: true, telefono: true, whatsapp: true } },
  notify: { select: entidadSelect },
  consignatario: { select: entidadSelect },
  tipoEmbarque: { select: { id: true, codigo: true, descripcion: true } },
  mercado: { select: { id: true, codigo: true, descripcion: true } },
  paisDestino: { select: { id: true, codigo: true, descripcion: true } },
  puertoDestino: { select: { id: true, codigo: true, descripcion: true } },
  direccion: { select: { id: true, codigo: true, direccion: true } },
  moneda: { select: { id: true, codigo: true, descripcion: true } },
  modalidadVenta: { select: { id: true, codigo: true, descripcion: true } },
  clausulaVenta: { select: { id: true, codigo: true, descripcion: true } },
  tipoFlete: { select: { id: true, codigo: true, descripcion: true } },
  condicionPago: { select: { id: true, codigo: true, descripcion: true } },
  cuotasPago: {
    include: {
      moneda: { select: { id: true, codigo: true, descripcion: true } },
      unidad: { select: { id: true, codigo: true, descripcion: true } },
    },
  },
  detalles: {
    include: {
      especie: { select: { id: true, codigo: true, descripcion: true } },
      variedad: { select: { id: true, codigo: true, descripcion: true } },
      articulo: { select: { id: true, codigo: true, descripcion: true, etiqueta: true, kgNetoEnvase: true, kgBrutoEnvase: true } },
      categoria: { select: { id: true, codigo: true, descripcion: true } },
      tipoPallet: { select: { id: true, codigo: true, descripcion: true } },
      calibres: { select: { calibre: { select: { id: true, codigo: true, descripcion: true } } } },
    },
  },
}

// Estado OC de cada Cierre listado (2026-08-23): PENDIENTE si queda alguna
// caja sin comprometer (o el Cierre no tiene líneas todavía) por alguna OC
// vigente; COMPLETA si toda la fruta del Cierre ya está cubierta. Se resuelve
// en 2 pasadas (traer detalles de los Cierres de esta página, agregar
// comprometido por detalle) — mismo motivo que
// ordenes-compra.repository.ts getNotaVentaDetalleConDisponibilidad: Prisma
// no soporta un groupBy anidado contra una relación N:1 indirecta.
async function resolverEstadoOc(notaVentaIds: number[]): Promise<Map<number, 'PENDIENTE' | 'COMPLETA'>> {
  const estadoPorNota = new Map<number, 'PENDIENTE' | 'COMPLETA'>()
  if (notaVentaIds.length === 0) return estadoPorNota

  const detalles = await prisma.notaVentaDetalle.findMany({
    where: { notaVentaId: { in: notaVentaIds } },
    select: { id: true, notaVentaId: true, cajas: true },
  })
  const detalleIds = detalles.map((d) => d.id)
  const comprometidos = detalleIds.length > 0
    ? await prisma.ordenCompraLinea.groupBy({
        by: ['notaVentaDetalleId'],
        where: { notaVentaDetalleId: { in: detalleIds }, ordenCompra: { eliminadoEn: null } },
        _sum: { cajas: true },
      })
    : []
  const comprometidoPorDetalle = new Map(comprometidos.map((c) => [c.notaVentaDetalleId, c._sum.cajas ?? 0]))

  for (const notaVentaId of notaVentaIds) {
    const lineasDeEsteNota = detalles.filter((d) => d.notaVentaId === notaVentaId)
    const totalCajas = lineasDeEsteNota.reduce((acc, d) => acc + d.cajas, 0)
    const comprometidoCajas = lineasDeEsteNota.reduce((acc, d) => acc + (comprometidoPorDetalle.get(d.id) ?? 0), 0)
    estadoPorNota.set(notaVentaId, totalCajas > 0 && comprometidoCajas >= totalCajas ? 'COMPLETA' : 'PENDIENTE')
  }
  return estadoPorNota
}

export async function listNotasVenta(page: number, limit: number, clienteId?: number) {
  const where = {
    eliminadoEn: null,
    ...(clienteId ? { clienteId } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.notaVenta.findMany({
      where,
      include: {
        cliente: { select: entidadSelect },
        mercado: { select: { id: true, codigo: true, descripcion: true } },
        moneda: { select: { id: true, codigo: true, descripcion: true } },
      },
      orderBy: { folio: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notaVenta.count({ where }),
  ])

  const estadoOcPorNota = await resolverEstadoOc(data.map((d) => d.id))
  const dataConEstadoOc = data.map((d) => ({ ...d, estadoOc: estadoOcPorNota.get(d.id) ?? 'PENDIENTE' }))

  return { data: dataConEstadoOc, total }
}

// Cajas ya comprometidas por OrdenCompraLinea vigentes (de OC no eliminadas)
// contra una línea del Cierre — usado por las guardas de eliminar/editar una
// línea (2026-08-23, ver notas-venta.service.ts).
export async function getCajasComprometidas(notaVentaDetalleId: number) {
  const result = await prisma.ordenCompraLinea.aggregate({
    where: { notaVentaDetalleId, ordenCompra: { eliminadoEn: null } },
    _sum: { cajas: true },
  })
  return result._sum.cajas ?? 0
}

// Línea completa (con calibres) para comparar contra un PATCH cuando ya
// tiene cajas comprometidas — ver actualizarDetalle en notas-venta.service.ts.
export async function getDetalleParaComparar(id: number) {
  return prisma.notaVentaDetalle.findUnique({
    where: { id },
    include: { calibres: { select: { calibreId: true } } },
  })
}

export async function getNotaVentaById(id: number) {
  return prisma.notaVenta.findFirst({ where: { id, eliminadoEn: null }, include: includeDetalle })
}

const LOCK_NAMESPACE_NOTA_VENTA = 490234

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any

// Suma cajas totales de los detalles. Si la unidad de la cuota es "KG",
// convierte a kilos usando el kgNetoEnvase del artículo (embalaje) de cada
// detalle — rechaza (422) si algún artículo involucrado no tiene peso
// cargado, en vez de valorizar en cero en silencio (FAS-PMQ-R1-003).
async function calcularCantidadReal(
  tx: Tx,
  detalles: { cajas: number; articuloId: number }[],
  unidadId: number,
): Promise<Prisma.Decimal> {
  const totalCajas = detalles.reduce((acc, d) => acc + d.cajas, 0)

  const unidad = await tx.unidadMedida.findUnique({ where: { id: unidadId }, select: { codigo: true } })
  if (unidad?.codigo !== 'KG') return new Prisma.Decimal(totalCajas)

  const articuloIds = [...new Set(detalles.map((d) => d.articuloId))]
  const articulos: { id: number; kgNetoEnvase: Prisma.Decimal | null }[] = await tx.articulo.findMany({
    where: { id: { in: articuloIds } },
    select: { id: true, kgNetoEnvase: true },
  })
  const pesoPorArticulo = new Map(articulos.map((a) => [a.id, a.kgNetoEnvase]))

  let total = new Prisma.Decimal(0)
  for (const d of detalles) {
    const peso = pesoPorArticulo.get(d.articuloId)
    if (peso == null || peso.lte(0)) {
      throw new ValidationError(
        `No se puede calcular la cuota en Kilo: el artículo de un detalle no tiene kg neto de envase cargado (id ${d.articuloId})`,
      )
    }
    total = total.plus(peso.mul(d.cajas))
  }
  return total
}

// Las cuotas de pago no se cargan manualmente: se copian desde la plantilla
// de la Condición de Pago seleccionada (snapshot, no referencia viva — si la
// plantilla cambia después no afecta Cierres Comerciales ya creados). Mismo
// patrón que ordenes-compra.repository.ts (Docs/ventas.md R12). El monto de
// una cuota MONTO_UNITARIO se resuelve contra los detalles de fruta que
// existan en ese momento — como se agregan de a uno después de crear el
// encabezado, `recalcularCuotasMontoUnitario` la vuelve a resolver cada vez
// que se agrega un detalle nuevo.
async function cuotasDesdeCondicionPago(
  tx: Tx,
  condicionPagoId: number | null | undefined,
  detalles: { cajas: number; articuloId: number }[],
) {
  if (!condicionPagoId) return []
  const condicionPago = await tx.condicionPago.findFirst({
    where: { id: condicionPagoId, eliminadoEn: null },
    include: { cuotas: true },
  })
  if (!condicionPago) return []

  return Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    condicionPago.cuotas.map(async (c: any) => {
      const montoCalculado =
        c.tipoValor === 'MONTO_UNITARIO'
          ? (c.valorUnitario as Prisma.Decimal).mul(await calcularCantidadReal(tx, detalles, c.unidadId))
          : null
      return {
        fechaReferencia: c.fechaReferencia,
        plazoDias: c.plazoDias,
        tipoValor: c.tipoValor,
        porcentaje: c.porcentaje,
        valorUnitario: c.valorUnitario,
        monedaId: c.monedaId,
        unidadId: c.unidadId,
        montoCalculado,
        descripcion: c.descripcion,
      }
    }),
  )
}

// Recalcula `montoCalculado` de las cuotas MONTO_UNITARIO ya guardadas contra
// el total de detalles actual — se llama después de agregar cada detalle
// nuevo, para que el monto refleje la fruta comprometida real.
async function recalcularCuotasMontoUnitario(tx: Tx, notaVentaId: number) {
  const cuotasMontoUnitario = await tx.notaVentaCuotaPago.findMany({
    where: { notaVentaId, tipoValor: 'MONTO_UNITARIO' },
  })
  if (cuotasMontoUnitario.length === 0) return

  const detalles = await tx.notaVentaDetalle.findMany({
    where: { notaVentaId },
    select: { cajas: true, articuloId: true },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const cuota of cuotasMontoUnitario as any[]) {
    const montoCalculado = (cuota.valorUnitario as Prisma.Decimal).mul(await calcularCantidadReal(tx, detalles, cuota.unidadId))
    await tx.notaVentaCuotaPago.update({ where: { id: cuota.id }, data: { montoCalculado } })
  }
}

export async function createNotaVenta(data: NotaVentaCreateInput, creadoPor: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_NOTA_VENTA}::int, 0)`

    const max = await tx.notaVenta.aggregate({ _max: { folio: true } })
    const folio = (max._max.folio ?? 0) + 1
    const cuotasPago = await cuotasDesdeCondicionPago(tx, data.condicionPagoId, [])

    return tx.notaVenta.create({
      // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe
      // este valor con la empresa activa del contexto — se declara aquí solo
      // para satisfacer el tipo requerido por Prisma.
      data: { empresaId: getEmpresaIdActual()!, ...data, folio, creadoPor, cuotasPago: { create: cuotasPago } },
      include: includeDetalle,
    })
  })
}

export async function updateNotaVenta(id: number, data: NotaVentaUpdateInput, actualizadoPor: string) {
  return prisma.$transaction(async (tx) => {
    if (data.condicionPagoId !== undefined) {
      // El snapshot es inmutable (R12): regenerarlo solo si condicionPagoId
      // realmente cambió respecto del valor persistido — el formulario puede
      // reenviarlo sin cambios en cualquier PATCH (ej. al editar Observaciones).
      const actual = await tx.notaVenta.findUniqueOrThrow({ where: { id }, select: { condicionPagoId: true } })
      if (data.condicionPagoId !== actual.condicionPagoId) {
        const detallesActuales = await tx.notaVentaDetalle.findMany({ where: { notaVentaId: id }, select: { cajas: true, articuloId: true } })
        const cuotasPago = await cuotasDesdeCondicionPago(tx, data.condicionPagoId, detallesActuales)
        await tx.notaVentaCuotaPago.deleteMany({ where: { notaVentaId: id } })
        await tx.notaVentaCuotaPago.createMany({ data: cuotasPago.map((c) => ({ notaVentaId: id, ...c })) })
      }
    }
    return tx.notaVenta.update({
      where: { id },
      data: { ...data, actualizadoPor },
      include: includeDetalle,
    })
  })
}

// R3 (Docs/ventas.md): una NV con Embarque asociado no puede eliminarse.
export async function countEmbarques(notaVentaId: number) {
  return prisma.embarque.count({ where: { notaVentaId, eliminadoEn: null } })
}

export async function softDeleteNotaVenta(id: number, eliminadoPor: string) {
  return prisma.notaVenta.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor },
  })
}

const detalleInclude = {
  especie: { select: { id: true, codigo: true, descripcion: true } },
  variedad: { select: { id: true, codigo: true, descripcion: true } },
  articulo: { select: { id: true, codigo: true, descripcion: true, etiqueta: true, kgNetoEnvase: true, kgBrutoEnvase: true } },
  categoria: { select: { id: true, codigo: true, descripcion: true } },
  tipoPallet: { select: { id: true, codigo: true, descripcion: true } },
  calibres: { select: { calibre: { select: { id: true, codigo: true, descripcion: true } } } },
}

export async function addDetalle(notaVentaId: number, data: NotaVentaDetalleCreateInput) {
  const { calibreIds, ...resto } = data
  return prisma.$transaction(async (tx) => {
    const detalle = await tx.notaVentaDetalle.create({
      data: { ...resto, notaVentaId, calibres: { create: calibreIds.map((calibreId) => ({ calibreId })) } },
      include: detalleInclude,
    })
    await recalcularCuotasMontoUnitario(tx, notaVentaId)
    return detalle
  })
}

export async function getDetalleById(id: number) {
  return prisma.notaVentaDetalle.findUnique({ where: { id }, select: { id: true, notaVentaId: true } })
}

function calibresIguales(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const setA = new Set(a)
  return b.every((id) => setA.has(id))
}

// Re-chequeo atómico del comprometido (FAS-OCNV-002, QA ronda 1) — toma el
// MISMO LOCK_NAMESPACE_NOTA_VENTA_DETALLE que
// ordenes-compra.repository.ts::verificarDisponibleBajoLock usa para
// comprometer cajas, serializando esta edición/eliminación contra una OC
// tomando cajas de esta misma línea justo en el mismo instante. El service ya
// hizo un pre-check con estos mismos datos, pero sin lock (no bloqueado,
// mensaje amigable) — esto es la autoridad real, justo antes de escribir.
async function getComprometidoBajoLock(tx: Tx, detalleId: number): Promise<number> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_NOTA_VENTA_DETALLE}::int, ${detalleId}::int)`
  const result = await tx.ordenCompraLinea.aggregate({
    where: { notaVentaDetalleId: detalleId, ordenCompra: { eliminadoEn: null } },
    _sum: { cajas: true },
  })
  return result._sum.cajas ?? 0
}

export async function updateDetalle(id: number, data: NotaVentaDetalleUpdateInput) {
  const { calibreIds, ...resto } = data
  return prisma.$transaction(async (tx) => {
    const comprometido = await getComprometidoBajoLock(tx, id)
    if (comprometido > 0) {
      const actual = await tx.notaVentaDetalle.findUnique({
        where: { id },
        include: { calibres: { select: { calibreId: true } } },
      })
      if (!actual) throw new ValidationError('La línea de detalle ya no existe')
      const calibresActuales = actual.calibres.map((c: { calibreId: number }) => c.calibreId)
      const cambiaIdentidad =
        resto.especieId !== actual.especieId ||
        resto.variedadId !== actual.variedadId ||
        (resto.categoriaId ?? null) !== actual.categoriaId ||
        resto.articuloId !== actual.articuloId ||
        (resto.tipoPalletId ?? null) !== actual.tipoPalletId ||
        !calibresIguales(calibreIds, calibresActuales)
      if (cambiaIdentidad) {
        throw new ValidationError(
          'No se puede modificar especie, variedad, categoría, artículo, tipo de pallet o calibres: esta línea ya tiene cajas comprometidas por una Orden de Compra',
        )
      }
      if (resto.cajas < comprometido) {
        throw new ValidationError(`No se pueden reducir las cajas por debajo de lo ya comprometido por Orden de Compra (${comprometido})`)
      }
    }
    const detalle = await tx.notaVentaDetalle.update({
      where: { id },
      data: {
        ...resto,
        calibres: { deleteMany: {}, create: calibreIds.map((calibreId) => ({ calibreId })) },
      },
      include: detalleInclude,
    })
    await recalcularCuotasMontoUnitario(tx, detalle.notaVentaId)
    return detalle
  })
}

export async function removeDetalle(id: number, notaVentaId: number) {
  return prisma.$transaction(async (tx) => {
    const comprometido = await getComprometidoBajoLock(tx, id)
    if (comprometido > 0) {
      throw new ValidationError('No se puede eliminar una línea del Cierre Comercial que ya tiene cajas comprometidas por una Orden de Compra')
    }
    await tx.notaVentaDetalle.delete({ where: { id } })
    await recalcularCuotasMontoUnitario(tx, notaVentaId)
  })
}

// Solo retorna entidades activas y no eliminadas: un id ausente en el
// resultado se interpreta como "no existe / inactiva" (NV-IE-004).
export async function getEntidadTipos(ids: number[]) {
  return prisma.entidad.findMany({
    where: { id: { in: ids }, eliminadoEn: null, activo: true },
    select: { id: true, tipos: true },
  })
}

export async function getDireccion(direccionId: number) {
  return prisma.entidadDireccion.findFirst({
    where: { id: direccionId, eliminadoEn: null },
    select: { id: true, entidadId: true },
  })
}

export async function getTipoEmbarque(id: number) {
  return prisma.tipoEmbarque.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getMercado(id: number) {
  return prisma.mercado.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getPais(id: number) {
  return prisma.pais.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

// Fase 2b: Pais ya no tiene mercadoId propio (ver MercadoPais) — la
// pertenencia se verifica contra la tabla puente, tenant-scoped por la
// extensión de Prisma.
export async function paisPerteneceAMercado(paisId: number, mercadoId: number): Promise<boolean> {
  const fila = await prisma.mercadoPais.findFirst({ where: { paisId, mercadoId } })
  return fila != null
}

export async function getPuerto(id: number) {
  return prisma.puerto.findFirst({
    where: { id, eliminadoEn: null, bloqueado: false },
    select: { id: true, paisId: true, tipoEmbarqueId: true },
  })
}

export async function getMoneda(id: number) {
  return prisma.moneda.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getArticuloTipo(articuloId: number) {
  return prisma.articulo.findUnique({ where: { id: articuloId }, select: { id: true, tipo: true, activo: true } })
}

export async function getEspecie(especieId: number) {
  return prisma.especie.findFirst({ where: { id: especieId, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getVariedad(variedadId: number) {
  return prisma.variedad.findFirst({
    where: { id: variedadId, eliminadoEn: null, bloqueado: false },
    select: { id: true, especieId: true },
  })
}

export async function getCategoria(categoriaId: number) {
  return prisma.categoria.findFirst({
    where: { id: categoriaId, eliminadoEn: null, bloqueado: false },
    select: { id: true, especieId: true },
  })
}

export async function getTipoPallet(id: number) {
  return prisma.tipoPallet.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getCalibresActivos(ids: number[]) {
  return prisma.calibre.findMany({
    where: { id: { in: ids }, eliminadoEn: null, bloqueado: false },
    select: { id: true, especieId: true },
  })
}

export async function getContactoDeEntidad(contactoId: number, entidadId: number) {
  return prisma.entidadContacto.findFirst({ where: { id: contactoId, entidadId, eliminadoEn: null } })
}

export async function getCondicionPago(id: number) {
  return prisma.condicionPago.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

// Valida que el Parametro exista, esté vigente y pertenezca al TipoParametro
// esperado (ej. 'INCOTERM', 'TIPO_FLETE', 'MODALIDAD_VENTA') — evita que se
// seleccione un valor de un catálogo genérico distinto al del campo.
export async function getParametro(id: number, tipoParametroCodigo: string) {
  return prisma.parametro.findFirst({
    where: { id, eliminadoEn: null, bloqueado: false, tipoParametro: { codigo: tipoParametroCodigo } },
    select: { id: true },
  })
}
