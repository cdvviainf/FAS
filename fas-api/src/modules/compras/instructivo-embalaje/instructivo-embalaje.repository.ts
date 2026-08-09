import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import type { InstructivoEmbalajeDetalleInput } from './instructivo-embalaje.types.js'

const mantenedorSelect = { id: true, codigo: true, descripcion: true }

const includeDetalle = {
  notaVenta: { select: { id: true, folio: true, cliente: { select: { id: true, descripcion: true, razonSocial: true } } } },
  detalle: {
    include: {
      articulo: { select: mantenedorSelect },
      especie: { select: mantenedorSelect },
      variedad: { select: mantenedorSelect },
      categoria: { select: mantenedorSelect },
      calibres: { select: { calibre: { select: mantenedorSelect } } },
      tipoPallet: { select: mantenedorSelect },
    },
  },
}

export async function listInstructivos(page: number, limit: number, notaVentaId?: number) {
  const where = notaVentaId ? { notaVentaId } : {}

  const [data, total] = await Promise.all([
    prisma.instructivoEmbalaje.findMany({
      where,
      include: {
        notaVenta: { select: { id: true, folio: true } },
      },
      orderBy: { numero: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.instructivoEmbalaje.count({ where }),
  ])

  return { data, total }
}

export async function getInstructivoById(id: number) {
  return prisma.instructivoEmbalaje.findUnique({ where: { id }, include: includeDetalle })
}

const LOCK_NAMESPACE_INSTRUCTIVO_EMBALAJE = 490235

export async function createInstructivo(notaVentaId: number, detalle: InstructivoEmbalajeDetalleInput[], creadoPor: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_INSTRUCTIVO_EMBALAJE}::int, 0)`

    const max = await tx.instructivoEmbalaje.aggregate({ _max: { numero: true } })
    const numero = (max._max.numero ?? 0) + 1

    return tx.instructivoEmbalaje.create({
      data: {
        // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe
        // este valor con la empresa activa del contexto — se declara aquí
        // solo para satisfacer el tipo requerido por Prisma.
        empresaId: getEmpresaIdActual()!,
        numero,
        notaVentaId,
        creadoPor,
        detalle: {
          create: detalle.map(({ calibreIds, ...resto }) => ({
            ...resto,
            calibres: { create: calibreIds.map((calibreId) => ({ calibreId })) },
          })),
        },
      },
      include: includeDetalle,
    })
  })
}

export async function getNotaVenta(notaVentaId: number) {
  return prisma.notaVenta.findFirst({ where: { id: notaVentaId, eliminadoEn: null }, select: { id: true } })
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

export async function getCalibresActivos(ids: number[]) {
  return prisma.calibre.findMany({
    where: { id: { in: ids }, eliminadoEn: null, bloqueado: false },
    select: { id: true, especieId: true },
  })
}

export async function getTipoPallet(id: number) {
  return prisma.tipoPallet.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}
