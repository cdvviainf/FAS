import { prisma } from '../../../lib/prisma.js'

const usuarioSelect = {
  id: true,
  nombre: true,
  email: true,
  whatsapp: true,
  imagenUrl: true,
  perfilId: true,
  esResponsableVenta: true,
  empresaPredeterminadaId: true,
  creadoEn: true,
  actualizadoEn: true,
  perfil: { select: { id: true, codigo: true, descripcion: true } },
  usuarioEmpresas: {
    select: {
      empresa: { select: { id: true, codigo: true, razonSocial: true, activo: true } },
    },
    orderBy: { empresa: { codigo: 'asc' as const } },
  },
}

// Prisma no puede aplanar una relación 1:N directamente en el select; se
// devuelve `usuarioEmpresas: [{ empresa: {...} }]` y aquí se aplana a
// `empresas: [{...}]`, que es la forma que consume el frontend.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapUsuario<T extends { usuarioEmpresas: { empresa: any }[] }>(row: T) {
  const { usuarioEmpresas, ...rest } = row
  return { ...rest, empresas: usuarioEmpresas.map((ue) => ue.empresa) }
}

export async function findAllUsuarios(page: number, limit: number, q?: string, perfilId?: number, esResponsableVenta?: boolean) {
  const where = {
    eliminadoEn: null,
    ...(perfilId ? { perfilId } : {}),
    ...(esResponsableVenta !== undefined ? { esResponsableVenta } : {}),
    ...(q
      ? {
          OR: [
            { nombre: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.usuario.findMany({
      where,
      select: usuarioSelect,
      orderBy: { nombre: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.usuario.count({ where }),
  ])

  return { data: rows.map(mapUsuario), total }
}

export async function findUsuarioById(id: string) {
  const row = await prisma.usuario.findFirst({
    where: { id, eliminadoEn: null },
    select: usuarioSelect,
  })
  return row ? mapUsuario(row) : null
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

/**
 * Crea el Usuario y sus membresías iniciales (UsuarioEmpresa) en una única
 * transacción: si `empresaPredeterminadaId` apunta a una de las empresas
 * recién asignadas, ambos cambios deben confirmarse juntos o ninguno —
 * de lo contrario podría persistir una predeterminada sin membresía
 * (invariante §2 de empresas.md).
 */
export async function createUsuario(data: {
  id: string
  nombre: string
  email: string
  whatsapp?: string
  imagenUrl?: string | null
  perfilId: number
  esResponsableVenta?: boolean
  empresaPredeterminadaId?: number | null
  empresas: number[]
  creadoPor?: string
}) {
  return prisma.$transaction(async (tx) => {
    await tx.usuario.create({
      data: {
        id: data.id,
        nombre: data.nombre,
        email: data.email,
        whatsapp: data.whatsapp ?? null,
        imagenUrl: data.imagenUrl ?? null,
        perfilId: data.perfilId,
        esResponsableVenta: data.esResponsableVenta ?? false,
        empresaPredeterminadaId: data.empresaPredeterminadaId ?? null,
        creadoPor: data.creadoPor ?? null,
      },
    })

    if (data.empresas.length > 0) {
      await tx.usuarioEmpresa.createMany({
        data: data.empresas.map((empresaId) => ({
          usuarioId: data.id,
          empresaId,
          creadoPor: data.creadoPor ?? 'system',
        })),
      })
    }

    const row = await tx.usuario.findFirstOrThrow({ where: { id: data.id }, select: usuarioSelect })
    return mapUsuario(row)
  })
}

/**
 * Actualiza el Usuario y, si `empresas` viene definido, reemplaza el set
 * completo de membresías (diff mínimo: solo crea/borra lo que cambió) —
 * todo en una única transacción, por la misma razón que `createUsuario`.
 * Sin soft delete: UsuarioEmpresa es una tabla de membresía pura (decisión
 * #2 de empresas.md), no un registro de negocio auditable.
 */
export async function updateUsuario(
  id: string,
  data: {
    nombre?: string
    whatsapp?: string | null
    imagenUrl?: string | null
    perfilId?: number
    esResponsableVenta?: boolean
    empresaPredeterminadaId?: number | null
    empresas?: number[]
    actualizadoPor?: string
  },
) {
  return prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id },
      data: {
        ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
        ...(data.whatsapp !== undefined ? { whatsapp: data.whatsapp } : {}),
        ...(data.imagenUrl !== undefined ? { imagenUrl: data.imagenUrl } : {}),
        ...(data.perfilId !== undefined ? { perfilId: data.perfilId } : {}),
        ...(data.esResponsableVenta !== undefined ? { esResponsableVenta: data.esResponsableVenta } : {}),
        ...(data.empresaPredeterminadaId !== undefined ? { empresaPredeterminadaId: data.empresaPredeterminadaId } : {}),
        ...(data.actualizadoPor !== undefined ? { actualizadoPor: data.actualizadoPor } : {}),
      },
    })

    if (data.empresas !== undefined) {
      const deseadas = new Set(data.empresas)
      const actuales = await tx.usuarioEmpresa.findMany({
        where: { usuarioId: id },
        select: { empresaId: true },
      })
      const actualesSet = new Set(actuales.map((a) => a.empresaId))

      const aCrear = [...deseadas].filter((eid) => !actualesSet.has(eid))
      const aBorrar = [...actualesSet].filter((eid) => !deseadas.has(eid))

      if (aBorrar.length > 0) {
        await tx.usuarioEmpresa.deleteMany({ where: { usuarioId: id, empresaId: { in: aBorrar } } })
      }
      if (aCrear.length > 0) {
        await tx.usuarioEmpresa.createMany({
          data: aCrear.map((empresaId) => ({
            usuarioId: id,
            empresaId,
            creadoPor: data.actualizadoPor ?? 'system',
          })),
        })
      }
    }

    const row = await tx.usuario.findFirstOrThrow({ where: { id }, select: usuarioSelect })
    return mapUsuario(row)
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
