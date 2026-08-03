import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { ValidationError } from '../../../shared/errors.js'
import type { OrdenCompraCreateInput, OrdenCompraUpdateInput } from './ordenes-compra.types.js'

const entidadSelect = { id: true, codigo: true, descripcion: true, razonSocial: true }
const mantenedorSelect = { id: true, codigo: true, descripcion: true }

const includeDetalle = {
  entidadProductor: { select: entidadSelect },
  notaVenta: { select: { id: true, folio: true } },
  moneda: { select: mantenedorSelect },
  formaPago: { select: mantenedorSelect },
  destinoMercado: { select: mantenedorSelect },
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
      calibreMin: { select: mantenedorSelect },
      calibreMax: { select: mantenedorSelect },
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

// Suma cajas totales (cantidadPallets × cajasPorPallet) de las líneas. Si la
// unidad de la cuota es "KG", convierte a kilos usando el kgNetoEnvase del
// artículo (embalaje) de cada línea — rechaza (422) si algún artículo
// involucrado no tiene peso cargado, en vez de valorizar en cero en
// silencio (FAS-PMQ-R1-003).
async function calcularCantidadReal(
  tx: Tx,
  lineas: { cantidadPallets: number; cajasPorPallet: number; articuloId: number }[],
  unidadId: number,
): Promise<Prisma.Decimal> {
  const totalCajas = lineas.reduce((acc, l) => acc + l.cantidadPallets * l.cajasPorPallet, 0)

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
    total = total.plus(peso.mul(l.cantidadPallets * l.cajasPorPallet))
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
  lineas: { cantidadPallets: number; cajasPorPallet: number; articuloId: number }[],
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
// las líneas actuales — se llama cada vez que se editan las líneas de una OC
// (mientras condicionPagoId no cambió), para que el monto no quede congelado
// contra cantidades viejas (FAS-PMQ-R1-004).
async function recalcularCuotasMontoUnitario(
  tx: Tx,
  ordenCompraId: number,
  lineas: { cantidadPallets: number; cajasPorPallet: number; articuloId: number }[],
) {
  const cuotasMontoUnitario = await tx.ordenCompraCuotaPago.findMany({
    where: { ordenCompraId, tipoValor: 'MONTO_UNITARIO' },
  })
  if (cuotasMontoUnitario.length === 0) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const cuota of cuotasMontoUnitario as any[]) {
    const montoCalculado = (cuota.valorUnitario as Prisma.Decimal).mul(await calcularCantidadReal(tx, lineas, cuota.unidadId))
    await tx.ordenCompraCuotaPago.update({ where: { id: cuota.id }, data: { montoCalculado } })
  }
}

export async function createOrdenCompra(data: OrdenCompraCreateInput, creadoPor: string) {
  const { lineas, ...cabecera } = data
  const anio = (data.fecha ?? new Date()).getFullYear()
  const prefijo = `OC-${anio}-`

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_ORDEN_COMPRA}::int, ${anio}::int)`

    const total = await tx.ordenCompra.count({ where: { numero: { startsWith: prefijo } } })
    const numero = `${prefijo}${String(total + 1).padStart(4, '0')}`
    const cuotasPago = await cuotasDesdeCondicionPago(tx, data.condicionPagoId, lineas)

    return tx.ordenCompra.create({
      data: {
        // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe
        // este valor con la empresa activa del contexto — se declara aquí
        // solo para satisfacer el tipo requerido por Prisma.
        empresaId: getEmpresaIdActual()!,
        ...cabecera,
        numero,
        creadoPor,
        lineas: { create: lineas },
        cuotasPago: { create: cuotasPago },
      },
      include: includeDetalle,
    })
  })
}

export async function updateOrdenCompra(id: number, data: OrdenCompraUpdateInput, actualizadoPor: string) {
  const { lineas, ...cabecera } = data

  return prisma.$transaction(async (tx) => {
    if (lineas !== undefined) {
      await tx.ordenCompraLinea.deleteMany({ where: { ordenCompraId: id } })
      await tx.ordenCompraLinea.createMany({ data: lineas.map((l) => ({ ordenCompraId: id, ...l })) })
    }
    if (data.condicionPagoId !== undefined) {
      // El snapshot es inmutable (mismo patrón que Cierre Comercial): solo se
      // regenera si condicionPagoId realmente cambió respecto del valor
      // persistido — el formulario puede reenviarlo sin cambios en cualquier
      // PATCH (ej. al editar Observaciones).
      const actual = await tx.ordenCompra.findUniqueOrThrow({ where: { id }, select: { condicionPagoId: true } })
      if (data.condicionPagoId !== actual.condicionPagoId) {
        const lineasActuales = lineas ?? (await tx.ordenCompraLinea.findMany({ where: { ordenCompraId: id } }))
        const cuotasPago = await cuotasDesdeCondicionPago(tx, data.condicionPagoId, lineasActuales)
        await tx.ordenCompraCuotaPago.deleteMany({ where: { ordenCompraId: id } })
        await tx.ordenCompraCuotaPago.createMany({ data: cuotasPago.map((c) => ({ ordenCompraId: id, ...c })) })
      } else if (lineas !== undefined) {
        // condicionPagoId no cambió, pero sí las líneas: el monto de la
        // cuota unitaria debe seguir la cantidad real vigente.
        await recalcularCuotasMontoUnitario(tx, id, lineas)
      }
    } else if (lineas !== undefined) {
      await recalcularCuotasMontoUnitario(tx, id, lineas)
    }
    return tx.ordenCompra.update({
      where: { id },
      data: { ...cabecera, actualizadoPor },
      include: includeDetalle,
    })
  })
}

export async function softDeleteOrdenCompra(id: number, eliminadoPor: string) {
  return prisma.ordenCompra.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor },
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

export async function getMoneda(id: number) {
  return prisma.moneda.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getFormaPago(id: number) {
  return prisma.formaPago.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getMercado(id: number) {
  return prisma.mercado.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
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

export async function getCalibre(id: number) {
  return prisma.calibre.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true, especieId: true, orden: true } })
}

export async function getArticuloTipo(id: number) {
  return prisma.articulo.findUnique({ where: { id }, select: { id: true, tipo: true, activo: true } })
}
