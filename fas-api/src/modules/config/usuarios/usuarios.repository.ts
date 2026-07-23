import { prisma } from '../../../lib/prisma.js'

const usuarioSelect = {
  id: true,
  nombre: true,
  email: true,
  whatsapp: true,
  imagenUrl: true,
  perfilId: true,
  creadoEn: true,
  actualizadoEn: true,
  perfil: { select: { id: true, codigo: true, descripcion: true } },
}

export async function findAllUsuarios(page: number, limit: number, q?: string, perfilId?: number) {
  const where = {
    eliminadoEn: null,
    ...(perfilId ? { perfilId } : {}),
    ...(q
      ? {
          OR: [
            { nombre: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [data, total] = await Promise.all([
    prisma.usuario.findMany({
      where,
      select: usuarioSelect,
      orderBy: { nombre: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.usuario.count({ where }),
  ])

  return { data, total }
}

export async function findUsuarioById(id: string) {
  return prisma.usuario.findFirst({
    where: { id, eliminadoEn: null },
    select: usuarioSelect,
  })
}

export async function findUsuarioByEmail(email: string, excludeId?: string) {
  return prisma.usuario.findFirst({
    where: {
      email,
      eliminadoEn: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export async function createUsuario(data: {
  id: string
  nombre: string
  email: string
  whatsapp?: string
  imagenUrl?: string | null
  perfilId: number
  creadoPor?: string
}) {
  return prisma.usuario.create({
    data: {
      id: data.id,
      nombre: data.nombre,
      email: data.email,
      whatsapp: data.whatsapp ?? null,
      imagenUrl: data.imagenUrl ?? null,
      perfilId: data.perfilId,
      creadoPor: data.creadoPor ?? null,
    },
    select: usuarioSelect,
  })
}

export async function updateUsuario(
  id: string,
  data: {
    nombre?: string
    whatsapp?: string | null
    imagenUrl?: string | null
    perfilId?: number
    actualizadoPor?: string
  },
) {
  return prisma.usuario.update({
    where: { id },
    data: {
      ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
      ...(data.whatsapp !== undefined ? { whatsapp: data.whatsapp } : {}),
      ...(data.imagenUrl !== undefined ? { imagenUrl: data.imagenUrl } : {}),
      ...(data.perfilId !== undefined ? { perfilId: data.perfilId } : {}),
      ...(data.actualizadoPor !== undefined ? { actualizadoPor: data.actualizadoPor } : {}),
    },
    select: usuarioSelect,
  })
}

const AVATAR_RUTA_PREFIJO = '/config/usuarios'

export async function upsertAvatar(id: string, data: { mime: string; tamano: number; datos: Buffer }) {
  return prisma.$transaction(async (tx) => {
    await tx.usuarioAvatar.upsert({
      where: { usuarioId: id },
      create: { usuarioId: id, mime: data.mime, tamano: data.tamano, datos: data.datos },
      update: { mime: data.mime, tamano: data.tamano, datos: data.datos },
    })
    return tx.usuario.update({
      where: { id },
      data: { imagenUrl: `${AVATAR_RUTA_PREFIJO}/${id}/avatar` },
      select: usuarioSelect,
    })
  })
}

export async function getAvatarContenido(id: string) {
  return prisma.usuarioAvatar.findUnique({ where: { usuarioId: id } })
}

export async function deleteAvatar(id: string) {
  return prisma.$transaction(async (tx) => {
    await tx.usuarioAvatar.deleteMany({ where: { usuarioId: id } })
    await tx.usuario.update({ where: { id }, data: { imagenUrl: null } })
  })
}

export async function softDeleteUsuario(id: string, deletedBy: string) {
  return prisma.usuario.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor: deletedBy },
  })
}

/**
 * Solicitudes de inspección vigentes vinculadas al usuario, ya sea como
 * asignado (Acudir/Notificar) o como solicitante (`creadoPor`). QAS-SI-001
 * re-test: el solicitante no quedaba cubierto, solo los asignados.
 */
export async function countSolicitudesVinculadas(usuarioId: string): Promise<number> {
  const [comoAsignado, comoSolicitante] = await Promise.all([
    prisma.solicitudInspeccionAsignado.count({
      where: { usuarioId, solicitud: { eliminadoEn: null } },
    }),
    prisma.solicitudInspeccion.count({
      where: { creadoPor: usuarioId, eliminadoEn: null },
    }),
  ])
  return comoAsignado + comoSolicitante
}
