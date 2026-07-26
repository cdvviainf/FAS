import { prisma } from '../../../lib/prisma.js'
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
    select: { id: true, codigo: true, descripcion: true, cuotas: { select: { id: true, porcentaje: true, plazoDias: true, descripcion: true } } },
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
  cuotasPago: true,
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

// Las cuotas de pago no se cargan manualmente: se copian desde la plantilla
// de la Condición de Pago seleccionada (snapshot, no referencia viva — si la
// plantilla cambia después no afecta OCs ya creadas).
async function cuotasDesdeCondicionPago(condicionPagoId: number | null | undefined) {
  if (!condicionPagoId) return []
  const condicionPago = await prisma.condicionPago.findFirst({
    where: { id: condicionPagoId, eliminadoEn: null },
    include: { cuotas: true },
  })
  if (!condicionPago) return []
  return condicionPago.cuotas.map((c) => ({
    porcentaje: c.porcentaje,
    plazoDias: c.plazoDias,
    descripcion: c.descripcion,
  }))
}

export async function createOrdenCompra(data: OrdenCompraCreateInput, creadoPor: string) {
  const { lineas, ...cabecera } = data
  const anio = (data.fecha ?? new Date()).getFullYear()
  const prefijo = `OC-${anio}-`
  const cuotasPago = await cuotasDesdeCondicionPago(data.condicionPagoId)

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_ORDEN_COMPRA}::int, ${anio}::int)`

    const total = await tx.ordenCompra.count({ where: { numero: { startsWith: prefijo } } })
    const numero = `${prefijo}${String(total + 1).padStart(4, '0')}`

    return tx.ordenCompra.create({
      data: {
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
      const cuotasPago = await cuotasDesdeCondicionPago(data.condicionPagoId)
      await tx.ordenCompraCuotaPago.deleteMany({ where: { ordenCompraId: id } })
      await tx.ordenCompraCuotaPago.createMany({ data: cuotasPago.map((c) => ({ ordenCompraId: id, ...c })) })
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
