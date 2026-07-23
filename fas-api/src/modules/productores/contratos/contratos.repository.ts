import { prisma } from '../../../lib/prisma.js'
import type { ContratoCreateInput, ContratoUpdateInput } from './contratos.types.js'

const includeRefs = {
  temporada: { select: { id: true, codigo: true, descripcion: true } },
}

export async function listContratosPorEntidad(entidadId: number) {
  return prisma.productorContrato.findMany({
    where: { entidadId, eliminadoEn: null },
    include: includeRefs,
    orderBy: { creadoEn: 'desc' },
  })
}

export async function getContratoById(entidadId: number, contratoId: number) {
  return prisma.productorContrato.findFirst({
    where: { id: contratoId, entidadId, eliminadoEn: null },
    include: includeRefs,
  })
}

function toDate(value?: string | null) {
  return value ? new Date(value) : value
}

export async function createContrato(entidadId: number, data: ContratoCreateInput, creadoPor: string) {
  return prisma.productorContrato.create({
    data: {
      ...data,
      fechaInicio: toDate(data.fechaInicio),
      fechaTermino: toDate(data.fechaTermino),
      entidadId,
      creadoPor,
    },
    include: includeRefs,
  })
}

export async function updateContrato(contratoId: number, data: ContratoUpdateInput, actualizadoPor: string) {
  return prisma.productorContrato.update({
    where: { id: contratoId },
    data: {
      ...data,
      ...(data.fechaInicio !== undefined ? { fechaInicio: toDate(data.fechaInicio) } : {}),
      ...(data.fechaTermino !== undefined ? { fechaTermino: toDate(data.fechaTermino) } : {}),
      actualizadoPor,
    },
    include: includeRefs,
  })
}

export async function softDeleteContrato(contratoId: number, eliminadoPor: string) {
  return prisma.productorContrato.update({
    where: { id: contratoId },
    data: { eliminadoEn: new Date(), eliminadoPor },
  })
}

// ─── PDF del contrato ────────────────────────────────────────────────────────

export async function guardarPdf(
  contratoId: number,
  meta: { nombre: string; mime: string; tamano: number },
  datos: Buffer,
) {
  return prisma.$transaction(async (tx) => {
    await tx.productorContratoPdf.deleteMany({ where: { contratoId } })
    await tx.productorContratoPdf.create({ data: { contratoId, datos } })
    return tx.productorContrato.update({
      where: { id: contratoId },
      data: { pdfNombre: meta.nombre, pdfMime: meta.mime, pdfTamano: meta.tamano },
      include: includeRefs,
    })
  })
}

export async function getPdfContenido(contratoId: number) {
  return prisma.productorContratoPdf.findUnique({ where: { contratoId } })
}

// PROD-03: la temporada debe existir, no estar eliminada ni bloqueada
export async function getTemporadaActiva(id: number) {
  return prisma.temporada.findFirst({ where: { id, eliminadoEn: null, bloqueado: false } })
}

// ─── Representante legal (R3) ────────────────────────────────────────────────

export async function tieneRepresentanteLegal(entidadId: number): Promise<boolean> {
  const count = await prisma.entidadContacto.count({
    where: { entidadId, eliminadoEn: null, esRepresentanteLegal: true },
  })
  return count > 0
}
