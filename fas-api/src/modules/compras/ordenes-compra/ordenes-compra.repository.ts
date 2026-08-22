import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { ValidationError } from '../../../shared/errors.js'
import { LOCK_NAMESPACE_ORDEN_COMPRA_PROCESO } from '../../../shared/advisory-locks.js'
import type {
  OrdenCompraCreateInput,
  OrdenCompraUpdateInput,
  OrdenCompraLineaCreateInput,
  OrdenCompraLineaUpdateInput,
} from './ordenes-compra.types.js'

const entidadSelect = { id: true, codigo: true, descripcion: true, razonSocial: true }
const mantenedorSelect = { id: true, codigo: true, descripcion: true }

const includeDetalle = {
  entidadProductor: { select: entidadSelect },
  notaVenta: { select: { id: true, folio: true } },
  // N:M (2026-08-22, Etapa 2) — reemplaza el solicitudInspeccion singular.
  solicitudes: {
    select: { id: true, solicitudInspeccion: { select: { id: true, codigo: true, estado: true } } },
    orderBy: { id: 'asc' as const },
  },
  moneda: { select: mantenedorSelect },
  formaPago: { select: mantenedorSelect },
  destinoMercado: { select: mantenedorSelect },
  incoterm: { select: mantenedorSelect },
  responsable: { select: { id: true, nombre: true, email: true } },
  condicionPago: {
    select: { id: true, codigo: true, descripcion: true },
  },
  lineas: {
    include: {
      especie: { select: mantenedorSelect },
      variedad: { select: mantenedorSelect },
      categoria: { select: mantenedorSelect },
      articulo: { select: { id: true, codigo: true, descripcion: true, etiqueta: true, kgNetoEnvase: true, kgBrutoEnvase: true } },
      calibres: { select: { calibre: { select: mantenedorSelect } } },
      tipoPallet: { select: mantenedorSelect },
    },
  },
  cuotasPago: {
    include: {
      moneda: { select: mantenedorSelect },
      unidad: { select: mantenedorSelect },
    },
  },
}

export async function listOrdenesCompra(page: number, limit: number, entidadProductorId?: number, estado?: string) {
  const where = {
    eliminadoEn: null,
    ...(entidadProductorId ? { entidadProductorId } : {}),
    ...(estado ? { estado: estado as 'BORRADOR' | 'EMITIDA' | 'RECEPCIONADA' } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.ordenCompra.findMany({
      where,
      include: {
        entidadProductor: { select: entidadSelect },
        moneda: { select: mantenedorSelect },
        notaVenta: { select: { id: true, folio: true } },
      },
      orderBy: { id: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.ordenCompra.count({ where }),
  ])

  return { data, total }
}

export async function getOrdenCompraById(id: number) {
  return prisma.ordenCompra.findFirst({ where: { id, eliminadoEn: null }, include: includeDetalle })
}

const LOCK_NAMESPACE_ORDEN_COMPRA = 490236

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any

// QA-RCV-007: el chequeo de "editable" (estado !== RECEPCIONADA) en el
// service corre ANTES de esta transacción — no es atómico con la mutación.
// Toma el mismo lock por ordenCompraId que recepciones.repository.ts usa
// para crear pallets, y vuelve a leer el estado ya bajo ese lock: sirve
// tanto para serializar dos ediciones concurrentes entre sí como para
// serializar una edición contra una Recepción en curso.
async function lockYVerificarEditable(tx: Tx, ordenCompraId: number): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_ORDEN_COMPRA_PROCESO}::int, ${ordenCompraId}::int)`
  // eliminadoEn: null — QA-RCV-008 (ronda 5): sin este filtro, una edición
  // en curso podía completarse igual sobre una OC que otra solicitud
  // eliminó (soft delete) mientras esperaba el lock — findUniqueOrThrow por
  // id solo no distingue una fila borrada de una activa.
  const actual = await tx.ordenCompra.findFirst({ where: { id: ordenCompraId, eliminadoEn: null }, select: { estado: true } })
  if (!actual) {
    throw new ValidationError('La Orden de Compra ya no existe')
  }
  if (actual.estado === 'RECEPCIONADA') {
    throw new ValidationError('La Orden de Compra ya fue recepcionada y no puede editarse')
  }
}

// Suma cajas totales (columna `cajas`, no `cantidadPallets × cajasPorPallet`
// — cajasPorPallet es solo referencial, ver comentario en el schema/form) de
// las líneas. Si la unidad de la cuota es "KG", convierte a kilos usando el
// kgNetoEnvase del artículo (embalaje) de cada línea — rechaza (422) si algún
// artículo involucrado no tiene peso cargado, en vez de valorizar en cero en
// silencio (FAS-PMQ-R1-003).
async function calcularCantidadReal(
  tx: Tx,
  lineas: { cajas: number; articuloId: number }[],
  unidadId: number,
): Promise<Prisma.Decimal> {
  const totalCajas = lineas.reduce((acc, l) => acc + l.cajas, 0)

  const unidad = await tx.unidadMedida.findUnique({ where: { id: unidadId }, select: { codigo: true } })
  if (unidad?.codigo !== 'KG') return new Prisma.Decimal(totalCajas)

  const articuloIds = [...new Set(lineas.map((l) => l.articuloId))]
  const articulos: { id: number; kgNetoEnvase: Prisma.Decimal | null }[] = await tx.articulo.findMany({
    where: { id: { in: articuloIds } },
    select: { id: true, kgNetoEnvase: true },
  })
  const pesoPorArticulo = new Map(articulos.map((a) => [a.id, a.kgNetoEnvase]))

  let total = new Prisma.Decimal(0)
  for (const l of lineas) {
    const peso = pesoPorArticulo.get(l.articuloId)
    if (peso == null || peso.lte(0)) {
      throw new ValidationError(
        `No se puede calcular la cuota en Kilo: el artículo de una línea no tiene kg neto de envase cargado (id ${l.articuloId})`,
      )
    }
    total = total.plus(peso.mul(l.cajas))
  }
  return total
}

// Las cuotas de pago no se cargan manualmente: se copian desde la plantilla
// de la Condición de Pago seleccionada (snapshot, no referencia viva — si la
// plantilla cambia después no afecta OCs ya creadas). Para la cuota con
// tipoValor MONTO_UNITARIO, además se resuelve y congela `montoCalculado`
// (valorUnitario × cantidad real de cajas/kilos de las líneas de esta OC).
async function cuotasDesdeCondicionPago(
  tx: Tx,
  condicionPagoId: number | null | undefined,
  lineas: { cajas: number; articuloId: number }[],
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
          ? (c.valorUnitario as Prisma.Decimal).mul(await calcularCantidadReal(tx, lineas, c.unidadId))
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
// las líneas actuales — se llama cada vez que se agrega/edita/elimina una
// línea de la OC, para que el monto no quede congelado contra cantidades
// viejas (FAS-PMQ-R1-004). Consulta las líneas vigentes internamente (mismo
// patrón que notas-venta.repository.ts) en vez de recibirlas del caller.
async function recalcularCuotasMontoUnitario(tx: Tx, ordenCompraId: number) {
  const cuotasMontoUnitario = await tx.ordenCompraCuotaPago.findMany({
    where: { ordenCompraId, tipoValor: 'MONTO_UNITARIO' },
  })
  if (cuotasMontoUnitario.length === 0) return

  const lineas = await tx.ordenCompraLinea.findMany({
    where: { ordenCompraId },
    select: { cajas: true, articuloId: true },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const cuota of cuotasMontoUnitario as any[]) {
    const montoCalculado = (cuota.valorUnitario as Prisma.Decimal).mul(await calcularCantidadReal(tx, lineas, cuota.unidadId))
    await tx.ordenCompraCuotaPago.update({ where: { id: cuota.id }, data: { montoCalculado } })
  }
}

export async function createOrdenCompra(data: OrdenCompraCreateInput, creadoPor: string) {
  const anio = (data.fecha ?? new Date()).getFullYear()
  const prefijo = `OC-${anio}-`
  const { solicitudInspeccionIds, ...resto } = data

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_ORDEN_COMPRA}::int, ${anio}::int)`

    const total = await tx.ordenCompra.count({ where: { numero: { startsWith: prefijo } } })
    const numero = `${prefijo}${String(total + 1).padStart(4, '0')}`
    // Sin líneas al crear (se agregan de a una después, ver addLinea) —
    // mismo patrón que createNotaVenta.
    const cuotasPago = await cuotasDesdeCondicionPago(tx, data.condicionPagoId, [])

    return tx.ordenCompra.create({
      data: {
        // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe
        // este valor con la empresa activa del contexto — se declara aquí
        // solo para satisfacer el tipo requerido por Prisma.
        empresaId: getEmpresaIdActual()!,
        ...resto,
        numero,
        creadoPor,
        cuotasPago: { create: cuotasPago },
        // N:M (2026-08-22, Etapa 2) — el @@unique(empresaId, solicitudInspeccionId)
        // de la tabla puente es la última defensa contra doble vínculo; el
        // service ya valida antes con un mensaje amigable.
        solicitudes: {
          create: solicitudInspeccionIds.map((solicitudInspeccionId) => ({ solicitudInspeccionId, creadoPor })),
        },
      },
      include: includeDetalle,
    })
  })
}

export async function updateOrdenCompra(id: number, data: OrdenCompraUpdateInput, actualizadoPor: string) {
  const { solicitudInspeccionIds, ...resto } = data
  return prisma.$transaction(async (tx) => {
    await lockYVerificarEditable(tx, id)
    if (data.condicionPagoId !== undefined) {
      // El snapshot es inmutable (mismo patrón que Cierre Comercial): solo se
      // regenera si condicionPagoId realmente cambió respecto del valor
      // persistido — el formulario puede reenviarlo sin cambios en cualquier
      // PATCH (ej. al editar Observaciones).
      const actual = await tx.ordenCompra.findUniqueOrThrow({ where: { id }, select: { condicionPagoId: true } })
      if (data.condicionPagoId !== actual.condicionPagoId) {
        const lineasActuales = await tx.ordenCompraLinea.findMany({ where: { ordenCompraId: id } })
        const cuotasPago = await cuotasDesdeCondicionPago(tx, data.condicionPagoId, lineasActuales)
        await tx.ordenCompraCuotaPago.deleteMany({ where: { ordenCompraId: id } })
        await tx.ordenCompraCuotaPago.createMany({ data: cuotasPago.map((c) => ({ ordenCompraId: id, ...c })) })
      }
    }
    return tx.ordenCompra.update({
      where: { id },
      data: {
        ...resto,
        actualizadoPor,
        // N:M (2026-08-22, Etapa 2): si viene, reemplaza el conjunto completo
        // (mismo patrón que calibres en updateLinea) — si no viene, se
        // conservan los vínculos existentes.
        ...(solicitudInspeccionIds
          ? {
              solicitudes: {
                deleteMany: {},
                create: solicitudInspeccionIds.map((solicitudInspeccionId) => ({ solicitudInspeccionId, creadoPor: actualizadoPor })),
              },
            }
          : {}),
      },
      include: includeDetalle,
    })
  })
}

const lineaInclude = {
  especie: { select: mantenedorSelect },
  variedad: { select: mantenedorSelect },
  categoria: { select: mantenedorSelect },
  articulo: { select: { id: true, codigo: true, descripcion: true, etiqueta: true, kgNetoEnvase: true, kgBrutoEnvase: true } },
  calibres: { select: { calibre: { select: mantenedorSelect } } },
  tipoPallet: { select: mantenedorSelect },
}

export async function addLinea(ordenCompraId: number, data: OrdenCompraLineaCreateInput) {
  const { calibreIds, ...resto } = data
  return prisma.$transaction(async (tx) => {
    await lockYVerificarEditable(tx, ordenCompraId)
    const linea = await tx.ordenCompraLinea.create({
      data: { ...resto, ordenCompraId, calibres: { create: calibreIds.map((calibreId) => ({ calibreId })) } },
      include: lineaInclude,
    })
    await recalcularCuotasMontoUnitario(tx, ordenCompraId)
    return linea
  })
}

export async function getLineaById(id: number) {
  return prisma.ordenCompraLinea.findUnique({ where: { id }, select: { id: true, ordenCompraId: true } })
}

export async function updateLinea(ordenCompraId: number, id: number, data: OrdenCompraLineaUpdateInput) {
  const { calibreIds, ...resto } = data
  return prisma.$transaction(async (tx) => {
    await lockYVerificarEditable(tx, ordenCompraId)
    const linea = await tx.ordenCompraLinea.update({
      where: { id },
      data: {
        ...resto,
        calibres: { deleteMany: {}, create: calibreIds.map((calibreId) => ({ calibreId })) },
      },
      include: lineaInclude,
    })
    await recalcularCuotasMontoUnitario(tx, linea.ordenCompraId)
    return linea
  })
}

export async function removeLinea(id: number, ordenCompraId: number) {
  return prisma.$transaction(async (tx) => {
    await lockYVerificarEditable(tx, ordenCompraId)
    await tx.ordenCompraLinea.delete({ where: { id } })
    await recalcularCuotasMontoUnitario(tx, ordenCompraId)
  })
}

export async function softDeleteOrdenCompra(id: number, eliminadoPor: string) {
  return prisma.$transaction(async (tx) => {
    await lockYVerificarEditable(tx, id)
    // Libera las Solicitudes de Inspección vinculadas (2026-08-22, decisión
    // de negocio, Christian): una OC eliminada no debe bloquear su Solicitud
    // para siempre — se borran las filas de la tabla puente (no la propia
    // Solicitud ni la OC, que sigue existiendo vía soft delete).
    await tx.ordenCompraSolicitudInspeccion.deleteMany({ where: { ordenCompraId: id } })
    return tx.ordenCompra.update({
      where: { id },
      data: { eliminadoEn: new Date(), eliminadoPor },
    })
  })
}

export async function getEntidadProductor(id: number) {
  return prisma.entidad.findFirst({
    where: { id, eliminadoEn: null, activo: true },
    select: { id: true, tipos: true },
  })
}

export async function getNotaVenta(id: number) {
  return prisma.notaVenta.findFirst({ where: { id, eliminadoEn: null }, select: { id: true } })
}

// La OC exige al menos una Inspección de Compra Aprobada del mismo productor
// entre TODAS las vinculadas (compras.md §4.2, N:M 2026-08-22) — se valida
// completo desde el service; este helper solo trae los datos necesarios.
export async function getSolicitudesInspeccion(ids: number[]) {
  return prisma.solicitudInspeccion.findMany({
    where: { id: { in: ids }, eliminadoEn: null },
    select: { id: true, estado: true, entidadProductorId: true },
  })
}

// Solicitudes de la lista que ya están vinculadas a OTRA Orden de Compra
// (excluyendo la propia, en una edición) — dato para un mensaje de error
// amigable antes de chocar con el @@unique de la tabla puente.
export async function getSolicitudesYaVinculadas(ids: number[], excluirOrdenCompraId?: number) {
  return prisma.ordenCompraSolicitudInspeccion.findMany({
    where: {
      solicitudInspeccionId: { in: ids },
      ...(excluirOrdenCompraId != null ? { ordenCompraId: { not: excluirOrdenCompraId } } : {}),
    },
    select: { solicitudInspeccionId: true, ordenCompraId: true },
  })
}

export async function getMoneda(id: number) {
  return prisma.moneda.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getFormaPago(id: number) {
  return prisma.formaPago.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getMercado(id: number) {
  return prisma.mercado.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

// Valida que el Parametro exista, esté vigente y pertenezca al TipoParametro
// esperado — mismo patrón que notas-venta.repository.ts (catálogo genérico
// Parametro compartido, ej. 'INCOTERM').
export async function getParametro(id: number, tipoParametroCodigo: string) {
  return prisma.parametro.findFirst({
    where: { id, eliminadoEn: null, bloqueado: false, tipoParametro: { codigo: tipoParametroCodigo } },
    select: { id: true },
  })
}

export async function getCondicionPago(id: number) {
  return prisma.condicionPago.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getUsuarioResponsable(id: string) {
  return prisma.usuario.findFirst({
    where: { id, eliminadoEn: null, esResponsableVenta: true },
    select: { id: true },
  })
}

export async function getEspecie(id: number) {
  return prisma.especie.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getVariedad(id: number) {
  return prisma.variedad.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true, especieId: true } })
}

export async function getCategoria(id: number) {
  return prisma.categoria.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true, especieId: true } })
}

export async function getCalibresActivos(ids: number[]) {
  return prisma.calibre.findMany({
    where: { id: { in: ids }, eliminadoEn: null, bloqueado: false },
    select: { id: true, especieId: true },
  })
}

export async function getArticuloTipo(id: number) {
  return prisma.articulo.findUnique({ where: { id }, select: { id: true, tipo: true, activo: true } })
}

export async function getTipoPallet(id: number) {
  return prisma.tipoPallet.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}
