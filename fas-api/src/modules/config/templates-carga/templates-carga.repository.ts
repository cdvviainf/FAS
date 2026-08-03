import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import type { TemplateCargaCreateInput, TemplateCargaUpdateInput } from './templates-carga.types.js'

const includeCampos = { campos: { orderBy: { id: 'asc' as const } } }

export async function listTemplatesCarga(q?: string) {
  return prisma.templateCarga.findMany({
    where: {
      eliminadoEn: null,
      ...(q ? { OR: [{ codigo: { contains: q, mode: 'insensitive' as const } }, { descripcion: { contains: q, mode: 'insensitive' as const } }] } : {}),
    },
    include: includeCampos,
    orderBy: { codigo: 'asc' },
  })
}

export async function getTemplateCargaById(id: number) {
  return prisma.templateCarga.findFirst({ where: { id, eliminadoEn: null }, include: includeCampos })
}

export async function findTemplateCargaByCodigo(codigo: string) {
  return prisma.templateCarga.findFirst({ where: { codigo, eliminadoEn: null } })
}

export async function createTemplateCarga(data: TemplateCargaCreateInput, creadoPor: string) {
  const { campos, ...cabecera } = data
  return prisma.templateCarga.create({
    // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe este
    // valor con la empresa activa del contexto — se declara aquí solo para
    // satisfacer el tipo requerido por Prisma.
    data: { empresaId: getEmpresaIdActual()!, ...cabecera, creadoPor, campos: { create: campos } },
    include: includeCampos,
  })
}

export async function updateTemplateCarga(id: number, data: TemplateCargaUpdateInput, actualizadoPor: string) {
  const { campos, ...cabecera } = data
  return prisma.$transaction(async (tx) => {
    if (campos !== undefined) {
      await tx.templateCargaCampo.deleteMany({ where: { templateCargaId: id } })
      await tx.templateCargaCampo.createMany({ data: campos.map((c) => ({ templateCargaId: id, ...c })) })
    }
    return tx.templateCarga.update({
      where: { id },
      data: { ...cabecera, actualizadoPor },
      include: includeCampos,
    })
  })
}

export async function softDeleteTemplateCarga(id: number, eliminadoPor: string) {
  return prisma.templateCarga.update({ where: { id }, data: { eliminadoEn: new Date(), eliminadoPor } })
}
