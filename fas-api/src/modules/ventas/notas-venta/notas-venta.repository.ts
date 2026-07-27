import { prisma } from '../../../lib/prisma.js'
import type { NotaVentaCreateInput, NotaVentaDetalleCreateInput, NotaVentaUpdateInput } from './notas-venta.types.js'

const entidadSelect = { id: true, codigo: true, descripcion: true, razonSocial: true }

const includeDetalle = {
  cliente: { select: entidadSelect },
  comprador: { select: entidadSelect },
  notify: { select: entidadSelect },
  clienteFinal: { select: entidadSelect },
  tipoEmbarque: { select: { id: true, codigo: true, descripcion: true } },
  mercado: { select: { id: true, codigo: true, descripcion: true } },
  paisDestino: { select: { id: true, codigo: true, descripcion: true } },
  puertoDestino: { select: { id: true, codigo: true, descripcion: true } },
  direccion: { select: { id: true, codigo: true, direccion: true } },
  moneda: { select: { id: true, codigo: true, descripcion: true } },
  detalles: {
    include: {
      especie: { select: { id: true, codigo: true, descripcion: true } },
      variedad: { select: { id: true, codigo: true, descripcion: true } },
      articulo: { select: { id: true, codigo: true, descripcion: true } },
      categoria: { select: { id: true, codigo: true, descripcion: true } },
      tipoPallet: { select: { id: true, codigo: true, descripcion: true } },
      calibres: { include: { calibre: { select: { id: true, codigo: true, descripcion: true } } } },
    },
  },
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

  return { data, total }
}

export async function getNotaVentaById(id: number) {
  return prisma.notaVenta.findFirst({ where: { id, eliminadoEn: null }, include: includeDetalle })
}

const LOCK_NAMESPACE_NOTA_VENTA = 490234

export async function createNotaVenta(data: NotaVentaCreateInput, creadoPor: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_NOTA_VENTA}::int, 0)`

    const max = await tx.notaVenta.aggregate({ _max: { folio: true } })
    const folio = (max._max.folio ?? 0) + 1

    return tx.notaVenta.create({
      data: { ...data, folio, creadoPor },
      include: includeDetalle,
    })
  })
}

export async function updateNotaVenta(id: number, data: NotaVentaUpdateInput, actualizadoPor: string) {
  return prisma.notaVenta.update({
    where: { id },
    data: { ...data, actualizadoPor },
    include: includeDetalle,
  })
}

export async function softDeleteNotaVenta(id: number, eliminadoPor: string) {
  return prisma.notaVenta.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor },
  })
}

export async function addDetalle(notaVentaId: number, data: NotaVentaDetalleCreateInput) {
  const { calibreIds, ...detalle } = data
  return prisma.notaVentaDetalle.create({
    data: {
      ...detalle,
      notaVentaId,
      calibres: { create: calibreIds.map((calibreId) => ({ calibreId })) },
    },
    include: {
      especie: { select: { id: true, codigo: true, descripcion: true } },
      variedad: { select: { id: true, codigo: true, descripcion: true } },
      articulo: { select: { id: true, codigo: true, descripcion: true } },
      categoria: { select: { id: true, codigo: true, descripcion: true } },
      tipoPallet: { select: { id: true, codigo: true, descripcion: true } },
      calibres: { include: { calibre: { select: { id: true, codigo: true, descripcion: true } } } },
    },
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
  return prisma.pais.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true, mercadoId: true } })
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

export async function getCalibres(calibreIds: number[]) {
  return prisma.calibre.findMany({
    where: { id: { in: calibreIds }, eliminadoEn: null, bloqueado: false },
    select: { id: true, especieId: true },
  })
}
