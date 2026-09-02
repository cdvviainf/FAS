import type { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { ValidationError } from '../../../shared/errors.js'
import { LOCK_NAMESPACE_EMBARQUE_DESPACHO } from '../../../shared/advisory-locks.js'
import { palletCalzaConDetalleNV } from './embarques.comparacion.js'

const notaVentaRefSelect = { id: true, folio: true }
const mantenedorSelect = { id: true, codigo: true, descripcion: true }
const entidadSelect = { id: true, codigo: true, descripcion: true }

// Detalle de origen de cada pallet — de qué OC (modo COMPRA) o de qué
// Instructivo(s) de Embalaje (modo PROCESO) viene, para que el paso
// "Seleccionar Pallets" del Embarque (y el detalle ya reservado) siempre
// pueda mostrar la trazabilidad completa (2026-09-02).
const palletInclude = {
  productor: { select: entidadSelect },
  recepcion: {
    select: {
      ordenCompra: { select: { id: true, numero: true } },
      instructivos: { select: { instructivo: { select: { id: true, numero: true } } } },
    },
  },
  lineas: {
    select: {
      especieId: true,
      especie: { select: mantenedorSelect },
      variedadId: true,
      variedad: { select: mantenedorSelect },
      categoriaId: true,
      categoria: { select: mantenedorSelect },
      articuloId: true,
      articulo: { select: mantenedorSelect },
      calibreId: true,
      calibre: { select: mantenedorSelect },
      cajas: true,
    },
  },
} satisfies Prisma.PalletInclude

export async function listEmbarques(page: number, limit: number, notaVentaId?: number) {
  const where = { eliminadoEn: null, ...(notaVentaId ? { notaVentaId } : {}) }
  const [data, total] = await Promise.all([
    prisma.embarque.findMany({
      where,
      include: { notaVenta: { select: notaVentaRefSelect }, _count: { select: { pallets: true } } },
      orderBy: { creadoEn: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.embarque.count({ where }),
  ])
  return { data, total }
}

export async function getEmbarqueById(id: number) {
  return prisma.embarque.findFirst({
    where: { id, eliminadoEn: null },
    include: {
      notaVenta: { select: notaVentaRefSelect },
      pallets: { include: palletInclude, orderBy: { id: 'asc' as const } },
    },
  })
}

// Detalle de la NV para el motor de comparación (§7 equivalente de
// Recepción, ver embarques.comparacion.ts) — mismo criterio que
// getOrdenCompraConLineas en recepciones.repository.ts.
export async function getNotaVentaConDetalle(id: number) {
  return prisma.notaVenta.findFirst({
    where: { id, eliminadoEn: null },
    include: { detalles: { include: { calibres: { select: { calibreId: true } } } } },
  })
}

// Pallets sin reservar (embarqueId null) que calzan con el detalle de la NV
// de este Embarque — candidatos para el paso "Seleccionar Pallets". El match
// es solo de catálogo (embarques.comparacion.ts), sin tope de cantidad.
export async function getPalletsDisponibles(
  detalleNV: NonNullable<Awaited<ReturnType<typeof getNotaVentaConDetalle>>>['detalles'],
) {
  const pallets = await prisma.pallet.findMany({
    where: { embarqueId: null },
    include: palletInclude,
    orderBy: { creadoEn: 'asc' },
  })
  return pallets.filter((p) => palletCalzaConDetalleNV(p.lineas, detalleNV))
}

// Reclamo atómico (mismo patrón que folios de Instructivo/Recepción de
// Proceso): updateMany condicionado a embarqueId=null evita que dos
// Embarques reserven el mismo pallet en una carrera concurrente. Envuelto en
// una transacción (EP-QA-001, QA ronda 1): sin esto, una reserva parcial
// (otro Embarque se llevó uno de los pallets en el medio) dejaba los demás
// ya asignados aunque el service lanzara error — el throw dentro de
// `$transaction` revierte todo el lote, no solo informa el fallo.
export async function reservarPalletsEnEmbarque(palletIds: number[], embarqueId: number) {
  await prisma.$transaction(async (tx) => {
    const claim = await tx.pallet.updateMany({
      where: { id: { in: palletIds }, embarqueId: null },
      data: { embarqueId },
    })
    if (claim.count !== palletIds.length) {
      throw new ValidationError('Uno o más pallets ya no están disponibles — puede que otro Embarque los haya reservado')
    }
  })
}

type DesvincularResultado = 'OK' | 'NO_ENCONTRADO' | 'DESPACHADO'

// Desvincula un pallet, serializado contra confirmarDespacho vía el mismo
// advisory lock por embarqueId (EP-QA-002, QA ronda 2): un filtro de
// relación (`embarque: { despachadoEn: null }`) por sí solo NO bloquea la
// fila de Embarque, así que una confirmación de despacho concurrente podía
// colarse en la ventana antes de que este UPDATE commiteara. Con el lock, la
// transacción que llega segunda espera a que la primera termine y relee un
// estado ya consistente.
export async function desvincularPallet(embarqueId: number, palletId: number): Promise<DesvincularResultado> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_EMBARQUE_DESPACHO}::int, ${embarqueId}::int)`

    const embarque = await tx.embarque.findFirst({ where: { id: embarqueId, eliminadoEn: null }, select: { despachadoEn: true } })
    if (!embarque) return 'NO_ENCONTRADO'
    if (embarque.despachadoEn) return 'DESPACHADO'

    const result = await tx.pallet.updateMany({ where: { id: palletId, embarqueId }, data: { embarqueId: null } })
    return result.count > 0 ? 'OK' : 'NO_ENCONTRADO'
  })
}

// Confirma el despacho — atómico y condicionado a que aún no esté despachado
// (evita una doble confirmación concurrente) y a que tenga al menos un
// pallet reservado (decisión de negocio, Christian: no se despacha vacío).
// Mismo advisory lock por embarqueId que desvincularPallet (EP-QA-002, QA
// ronda 2) — serializa ambas operaciones entre sí.
export async function confirmarDespacho(embarqueId: number, despachadoPor: string) {
  // El read final (getEmbarqueById) corre DESPUÉS de que la transacción
  // commitea, no adentro — usar `prisma` en vez de `tx` dentro del callback
  // haría un read sucio contra una escritura todavía no confirmada.
  const resultado = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_EMBARQUE_DESPACHO}::int, ${embarqueId}::int)`

    const embarque = await tx.embarque.findFirst({
      where: { id: embarqueId, eliminadoEn: null },
      include: { _count: { select: { pallets: true } } },
    })
    if (!embarque) return 'NO_ENCONTRADO' as const
    if (embarque.despachadoEn) return 'YA_DESPACHADO' as const
    if (embarque._count.pallets === 0) return 'SIN_PALLETS' as const

    const claim = await tx.embarque.updateMany({
      where: { id: embarqueId, despachadoEn: null },
      data: { despachadoEn: new Date(), despachadoPor },
    })
    return claim.count === 0 ? ('YA_DESPACHADO' as const) : ('OK' as const)
  })
  if (resultado !== 'OK') return resultado
  return getEmbarqueById(embarqueId)
}

export async function findByNumeroInstructivo(numeroInstructivo: string) {
  return prisma.embarque.findFirst({ where: { numeroInstructivo, eliminadoEn: null } })
}

export async function getNotaVenta(id: number) {
  return prisma.notaVenta.findFirst({
    where: { id, eliminadoEn: null },
    select: { id: true, folio: true, tipoEmbarqueId: true },
  })
}

export async function createEmbarque(notaVentaId: number, numeroInstructivo: string, creadoPor: string) {
  return prisma.embarque.create({
    // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe este
    // valor con la empresa activa del contexto — se declara aquí solo para
    // satisfacer el tipo requerido por Prisma.
    data: { empresaId: getEmpresaIdActual()!, notaVentaId, numeroInstructivo, creadoPor },
    include: { notaVenta: { select: notaVentaRefSelect } },
  })
}
