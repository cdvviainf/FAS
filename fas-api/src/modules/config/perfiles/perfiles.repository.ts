import { prisma } from '../../../lib/prisma.js'
import type { NivelAcceso, AccesoInput } from './perfiles.types.js'

export async function findAllPerfiles(page: number, limit: number, q?: string) {
  const where = {
    eliminadoEn: null,
    ...(q ? { OR: [{ codigo: { contains: q, mode: 'insensitive' as const } }, { descripcion: { contains: q, mode: 'insensitive' as const } }] } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.perfil.findMany({
      where,
      select: {
        id: true,
        codigo: true,
        descripcion: true,
        creadoEn: true,
        _count: { select: { usuarios: { where: { eliminadoEn: null } } } },
      },
      orderBy: { codigo: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.perfil.count({ where }),
  ])

  return { data, total }
}

export async function findPerfilById(id: number) {
  return prisma.perfil.findFirst({
    where: { id, eliminadoEn: null },
    include: {
      accesos: {
        include: {
          itemMenu: {
            select: { id: true, codigo: true, nombre: true, seccion: true, ruta: true, esAccion: true, orden: true },
          },
        },
      },
    },
  })
}

export async function findPerfilByCodigo(codigo: string, excludeId?: number) {
  return prisma.perfil.findFirst({
    where: {
      codigo,
      eliminadoEn: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export async function countUsuariosActivosByPerfilId(perfilId: number) {
  return prisma.usuario.count({
    where: { perfilId, eliminadoEn: null },
  })
}

export async function createPerfil(
  data: { codigo: string; descripcion: string; creadoPor: string },
  accesos: AccesoInput[],
) {
  return prisma.$transaction(async (tx) => {
    const perfil = await tx.perfil.create({
      data: {
        codigo: data.codigo,
        descripcion: data.descripcion,
        creadoPor: data.creadoPor,
      },
    })

    if (accesos.length > 0) {
      await tx.perfilAcceso.createMany({
        data: accesos.map((a) => ({
          perfilId: perfil.id,
          itemMenuId: a.itemMenuId,
          nivel: a.nivel,
        })),
      })
    }

    return tx.perfil.findFirst({
      where: { id: perfil.id },
      include: {
        accesos: { include: { itemMenu: { select: { id: true, codigo: true, nombre: true, seccion: true, ruta: true, esAccion: true, orden: true } } } },
      },
    })
  })
}

export async function updatePerfil(
  id: number,
  data: { codigo?: string; descripcion?: string; actualizadoPor: string },
  accesos?: AccesoInput[],
) {
  return prisma.$transaction(async (tx) => {
    await tx.perfil.update({
      where: { id },
      data: {
        ...(data.codigo !== undefined ? { codigo: data.codigo } : {}),
        ...(data.descripcion !== undefined ? { descripcion: data.descripcion } : {}),
        actualizadoPor: data.actualizadoPor,
      },
    })

    if (accesos !== undefined) {
      // Delete all existing and recreate (simpler than upsert for matrix)
      await tx.perfilAcceso.deleteMany({ where: { perfilId: id } })
      if (accesos.length > 0) {
        await tx.perfilAcceso.createMany({
          data: accesos.map((a) => ({
            perfilId: id,
            itemMenuId: a.itemMenuId,
            nivel: a.nivel,
          })),
        })
      }
    }

    return tx.perfil.findFirst({
      where: { id },
      include: {
        accesos: { include: { itemMenu: { select: { id: true, codigo: true, nombre: true, seccion: true, ruta: true, esAccion: true, orden: true } } } },
      },
    })
  })
}

export async function softDeletePerfil(id: number, deletedBy: string) {
  return prisma.perfil.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor: deletedBy },
  })
}

export async function findAllItemsMenu() {
  return prisma.itemMenu.findMany({
    where: { activo: true },
    orderBy: [{ seccion: 'asc' }, { orden: 'asc' }],
  })
}

export async function findAccesosByPerfilAndNivel(perfilId: number, nivelMinimo: NivelAcceso) {
  const niveles: NivelAcceso[] = nivelMinimo === 'LECTURA' ? ['LECTURA', 'TOTAL'] : ['TOTAL']
  return prisma.perfilAcceso.findMany({
    where: { perfilId, nivel: { in: niveles } },
    include: {
      itemMenu: { select: { id: true, codigo: true, nombre: true, seccion: true, ruta: true, esAccion: true, orden: true } },
    },
  })
}
