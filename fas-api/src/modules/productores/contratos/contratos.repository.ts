import { prisma } from '../../../lib/prisma.js'
import type { ContratoCreateInput, ContratoUpdateInput } from './contratos.types.js'

const mantenedorSelect = { id: true, codigo: true, descripcion: true }

const includeDetalle = {
  temporada: { select: mantenedorSelect },
  especie: { select: mantenedorSelect },
  lineas: {
    include: {
      articulo: { select: { id: true, codigo: true, descripcion: true, etiqueta: true, kgNetoEnvase: true, kgBrutoEnvase: true } },
      variedad: { select: mantenedorSelect },
      calibreDesde: { select: mantenedorSelect },
      calibreHasta: { select: mantenedorSelect },
      categoria: { select: mantenedorSelect },
      unidadMedida: { select: mantenedorSelect },
    },
  },
  adjuntos: {
    select: { id: true, nombre: true, mime: true, tamano: true, subidoEn: true, subidoPor: true },
    orderBy: { subidoEn: 'desc' as const },
  },
}

export async function listContratosPorEntidad(entidadId: number) {
  return prisma.productorContrato.findMany({
    where: { entidadId, eliminadoEn: null },
    include: includeDetalle,
    orderBy: { creadoEn: 'desc' },
  })
}

export async function getContratoById(entidadId: number, contratoId: number) {
  return prisma.productorContrato.findFirst({
    where: { id: contratoId, entidadId, eliminadoEn: null },
    include: includeDetalle,
  })
}

// Un contrato activo por especie-temporada (excluye el propio en edición)
export async function contarContratosPorEspecieTemporada(
  entidadId: number,
  especieId: number,
  temporadaId: number,
  excluirId?: number,
) {
  return prisma.productorContrato.count({
    where: {
      entidadId,
      especieId,
      temporadaId,
      eliminadoEn: null,
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
  })
}

export async function createContrato(entidadId: number, data: ContratoCreateInput, creadoPor: string) {
  const { lineas, ...cabecera } = data
  return prisma.productorContrato.create({
    data: {
      ...cabecera,
      fechaInicio: new Date(cabecera.fechaInicio),
      fechaTermino: new Date(cabecera.fechaTermino),
      entidadId,
      creadoPor,
      lineas: { create: lineas },
    },
    include: includeDetalle,
  })
}

export async function updateContrato(contratoId: number, data: ContratoUpdateInput, actualizadoPor: string) {
  const { lineas, ...cabecera } = data
  return prisma.$transaction(async (tx) => {
    if (lineas !== undefined) {
      await tx.productorContratoLinea.deleteMany({ where: { contratoId } })
      await tx.productorContratoLinea.createMany({ data: lineas.map((l) => ({ contratoId, ...l })) })
    }
    return tx.productorContrato.update({
      where: { id: contratoId },
      data: {
        ...cabecera,
        ...(cabecera.fechaInicio !== undefined ? { fechaInicio: new Date(cabecera.fechaInicio) } : {}),
        ...(cabecera.fechaTermino !== undefined ? { fechaTermino: new Date(cabecera.fechaTermino) } : {}),
        actualizadoPor,
      },
      include: includeDetalle,
    })
  })
}

export async function softDeleteContrato(contratoId: number, eliminadoPor: string) {
  return prisma.productorContrato.update({
    where: { id: contratoId },
    data: { eliminadoEn: new Date(), eliminadoPor },
  })
}

// ─── Adjuntos ────────────────────────────────────────────────────────────────

export async function agregarAdjunto(
  contratoId: number,
  meta: { nombre: string; mime: string; tamano: number },
  datos: Buffer,
  subidoPor: string,
) {
  return prisma.productorContratoAdjunto.create({
    data: {
      contratoId,
      nombre: meta.nombre,
      mime: meta.mime,
      tamano: meta.tamano,
      subidoPor,
      contenido: { create: { datos } },
    },
    select: { id: true, nombre: true, mime: true, tamano: true, subidoEn: true, subidoPor: true },
  })
}

export async function getAdjunto(contratoId: number, adjuntoId: number) {
  return prisma.productorContratoAdjunto.findFirst({ where: { id: adjuntoId, contratoId } })
}

export async function getAdjuntoContenido(adjuntoId: number) {
  return prisma.productorContratoAdjuntoContenido.findUnique({ where: { adjuntoId } })
}

export async function eliminarAdjunto(adjuntoId: number) {
  await prisma.productorContratoAdjunto.delete({ where: { id: adjuntoId } })
}

// ─── Referencias ─────────────────────────────────────────────────────────────

// PROD-03: la temporada debe existir, no estar eliminada ni bloqueada
export async function getTemporadaActiva(id: number) {
  return prisma.temporada.findFirst({ where: { id, eliminadoEn: null, bloqueado: false } })
}

export async function getEspecie(id: number) {
  return prisma.especie.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getArticuloTipo(id: number) {
  return prisma.articulo.findUnique({ where: { id }, select: { id: true, tipo: true, activo: true } })
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

export async function getUnidadMedida(id: number) {
  return prisma.unidadMedida.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

// ─── Representante legal (R3) ────────────────────────────────────────────────

export async function tieneRepresentanteLegal(entidadId: number): Promise<boolean> {
  const count = await prisma.entidadContacto.count({
    where: { entidadId, eliminadoEn: null, esRepresentanteLegal: true },
  })
  return count > 0
}
