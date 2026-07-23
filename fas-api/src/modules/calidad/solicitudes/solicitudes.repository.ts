import { prisma } from '../../../lib/prisma.js'
import type { Prisma } from '@prisma/client'
import { ConflictError } from '../../../shared/errors.js'
import type {
  AsignadoInput,
  EtapaAdjunto,
  SolicitudListFilters,
} from './solicitudes.types.js'

const includeDetalle = {
  temporada: { select: { id: true, codigo: true, descripcion: true } },
  entidadProductor: { select: { id: true, codigo: true, descripcion: true, razonSocial: true } },
  direccion: {
    select: {
      id: true,
      codigo: true,
      direccion: true,
      latitud: true,
      longitud: true,
      comuna: { select: { id: true, descripcion: true } },
      pais: { select: { id: true, descripcion: true } },
    },
  },
  contacto: {
    select: { id: true, nombre: true, email: true, telefono: true, whatsapp: true, tipo: true },
  },
  especie: { select: { id: true, codigo: true, descripcion: true } },
  motivo: { select: { id: true, codigo: true, descripcion: true } },
  asignados: {
    select: {
      id: true,
      usuarioId: true,
      funcion: true,
      usuario: { select: { id: true, nombre: true, email: true } },
    },
  },
  adjuntos: {
    select: { id: true, nombre: true, mime: true, tamano: true, etapa: true, subidoEn: true, subidoPor: true },
    orderBy: { subidoEn: 'asc' as const },
  },
} satisfies Prisma.SolicitudInspeccionInclude

// ─── Fechas: límites de día en zona America/Santiago (QAS-SI-009) ────────────

/** Offset (minutos) de America/Santiago respecto de UTC para un instante dado (maneja DST). */
function offsetSantiagoMin(at: Date): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  const p = Object.fromEntries(fmt.formatToParts(at).map((x) => [x.type, x.value]))
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour === 24 ? 0 : +p.hour, +p.minute, +p.second)
  return (asUTC - at.getTime()) / 60000
}

/** Instante UTC correspondiente a `YYYY-MM-DD` a una hora de pared en Santiago. */
function santiagoWallClockToUtc(fecha: string, hh: number, mm: number, ss: number, ms: number): Date {
  const [y, m, d] = fecha.split('-').map(Number)
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm, ss, ms))
  // Corrige por el offset real (dos pasadas cubren cambios de DST)
  const off1 = offsetSantiagoMin(guess)
  const corrected = new Date(guess.getTime() - off1 * 60000)
  const off2 = offsetSantiagoMin(corrected)
  return new Date(guess.getTime() - off2 * 60000)
}

function inicioDiaSantiago(fecha: string): Date {
  return santiagoWallClockToUtc(fecha, 0, 0, 0, 0)
}
function finDiaSantiago(fecha: string): Date {
  return santiagoWallClockToUtc(fecha, 23, 59, 59, 999)
}

function buildWhere(filters: SolicitudListFilters): Prisma.SolicitudInspeccionWhereInput {
  return {
    eliminadoEn: null,
    ...(filters.estado ? { estado: filters.estado } : {}),
    ...(filters.temporadaId ? { temporadaId: filters.temporadaId } : {}),
    ...(filters.entidadProductorId ? { entidadProductorId: filters.entidadProductorId } : {}),
    ...(filters.usuarioAsignadoId
      ? { asignados: { some: { usuarioId: filters.usuarioAsignadoId } } }
      : {}),
    ...((filters.fechaDesde || filters.fechaHasta)
      ? {
          fechaHora: {
            ...(filters.fechaDesde ? { gte: inicioDiaSantiago(filters.fechaDesde) } : {}),
            ...(filters.fechaHasta ? { lte: finDiaSantiago(filters.fechaHasta) } : {}),
          },
        }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { codigo: { contains: filters.q, mode: 'insensitive' as const } },
            { observaciones: { contains: filters.q, mode: 'insensitive' as const } },
            { entidadProductor: { descripcion: { contains: filters.q, mode: 'insensitive' as const } } },
            { motivo: { descripcion: { contains: filters.q, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  }
}

export async function listSolicitudes(filters: SolicitudListFilters) {
  const { page = 1, limit = 20 } = filters
  const where = buildWhere(filters)
  const [data, total] = await Promise.all([
    prisma.solicitudInspeccion.findMany({
      where,
      include: includeDetalle,
      orderBy: { fechaHora: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.solicitudInspeccion.count({ where }),
  ])
  return { data, total }
}

export async function getSolicitudById(id: number) {
  return prisma.solicitudInspeccion.findFirst({
    where: { id, eliminadoEn: null },
    include: includeDetalle,
  })
}

export interface SolicitudCoreData {
  entidadProductorId: number
  direccionId: number
  contactoId?: number | null
  especieId?: number | null
  fechaHora: Date
  motivoId: number
  observaciones?: string | null
}

/**
 * Crea la solicitud con numeración correlativa por temporada.
 * Usa un advisory lock transaccional por temporada para serializar el cálculo
 * de `numero` y evitar colisiones bajo concurrencia (QAS-SI-006). El índice
 * único `(temporadaId, numero)` es la última línea de defensa.
 */
export async function createSolicitud(
  temporadaId: number,
  temporadaCodigo: string,
  data: SolicitudCoreData,
  asignados: AsignadoInput[],
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    // Lock por temporada: dos altas simultáneas de la misma temporada se serializan;
    // temporadas distintas no se bloquean entre sí.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_SOLICITUD}::int, ${temporadaId}::int)`

    const max = await tx.solicitudInspeccion.aggregate({
      where: { temporadaId },
      _max: { numero: true },
    })
    const numero = (max._max.numero ?? 0) + 1
    const codigo = `SI-${temporadaCodigo}-${String(numero).padStart(4, '0')}`

    return tx.solicitudInspeccion.create({
      data: {
        numero,
        codigo,
        temporadaId,
        ...data,
        creadoPor: userId,
        asignados: { create: asignados },
      },
      include: includeDetalle,
    })
  })
}

// Namespace arbitrario para el advisory lock (evita colisión con otros locks de la app)
const LOCK_NAMESPACE_SOLICITUD = 490231

export async function updateSolicitud(
  id: number,
  data: Partial<SolicitudCoreData>,
  asignados: AsignadoInput[] | undefined,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    if (asignados !== undefined) {
      await tx.solicitudInspeccionAsignado.deleteMany({ where: { solicitudId: id } })
      await tx.solicitudInspeccionAsignado.createMany({
        data: asignados.map((a) => ({ solicitudId: id, ...a })),
      })
    }
    return tx.solicitudInspeccion.update({
      where: { id },
      data: { ...data, actualizadoPor: userId },
      include: includeDetalle,
    })
  })
}

/**
 * Ejecuta una transición de estado de forma atómica (QAS-SI-013): el `updateMany`
 * con `estado: estadoEsperado` en el `where` actúa como compare-and-swap a nivel
 * de BD, así dos requests concurrentes sobre la misma solicitud no pueden
 * ejecutar ambas la transición ni encolar el correo dos veces — solo una gana
 * la condición y la otra recibe `count: 0`.
 */
async function transicionAtomica(
  id: number,
  estadoEsperado: 'PENDIENTE' | 'NOTIFICADA' | 'CERRADA',
  data: Prisma.SolicitudInspeccionUpdateInput,
) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.solicitudInspeccion.updateMany({
      where: { id, estado: estadoEsperado, eliminadoEn: null },
      data,
    })
    if (result.count === 0) {
      throw new ConflictError(
        'La solicitud ya no está en el estado esperado: probablemente fue modificada por otro usuario. Recarga e intenta de nuevo.',
      )
    }
    return tx.solicitudInspeccion.findUniqueOrThrow({ where: { id }, include: includeDetalle })
  })
}

export async function marcarNotificada(id: number, userId: string) {
  return transicionAtomica(id, 'PENDIENTE', {
    estado: 'NOTIFICADA',
    notificadaEn: new Date(),
    actualizadoPor: userId,
  })
}

export async function cerrarSolicitud(id: number, comentarios: string, userId: string) {
  return transicionAtomica(id, 'NOTIFICADA', {
    estado: 'CERRADA',
    comentariosCierre: comentarios,
    fechaCierre: new Date(),
    cerradaPor: userId,
    actualizadoPor: userId,
  })
}

export async function reabrirSolicitud(id: number, userId: string) {
  // QAS-SI-004: al reabrir se limpian los datos de cierre para no dejar una
  // solicitud NOTIFICADA con evidencia de que sigue cerrada.
  return transicionAtomica(id, 'CERRADA', {
    estado: 'NOTIFICADA',
    comentariosCierre: null,
    fechaCierre: null,
    cerradaPor: null,
    actualizadoPor: userId,
  })
}

export async function softDeleteSolicitud(id: number, userId: string) {
  return prisma.solicitudInspeccion.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor: userId },
  })
}

export async function marcarRecordatorioEnviado(id: number) {
  return prisma.solicitudInspeccion.update({
    where: { id },
    data: { recordatorioEnviadoEn: new Date() },
  })
}

// ─── Adjuntos ────────────────────────────────────────────────────────────────

export async function createAdjunto(
  solicitudId: number,
  meta: { nombre: string; mime: string; tamano: number; etapa: EtapaAdjunto },
  datos: Buffer,
  userId: string,
) {
  return prisma.solicitudInspeccionAdjunto.create({
    data: {
      solicitudId,
      ...meta,
      subidoPor: userId,
      contenido: { create: { datos } },
    },
    select: { id: true, nombre: true, mime: true, tamano: true, etapa: true, subidoEn: true, subidoPor: true },
  })
}

export async function getAdjuntoMeta(solicitudId: number, adjuntoId: number) {
  return prisma.solicitudInspeccionAdjunto.findFirst({
    where: { id: adjuntoId, solicitudId },
  })
}

export async function getAdjuntoContenido(adjuntoId: number) {
  return prisma.solicitudInspeccionAdjuntoContenido.findUnique({
    where: { adjuntoId },
  })
}

export async function deleteAdjunto(adjuntoId: number) {
  // Delete físico: el contenido cae en cascada. Los adjuntos no son entidad de negocio principal.
  return prisma.solicitudInspeccionAdjunto.delete({ where: { id: adjuntoId } })
}

// ─── Auxiliares para validación ──────────────────────────────────────────────

export async function getDireccionDeEntidad(direccionId: number, entidadId: number) {
  return prisma.entidadDireccion.findFirst({
    where: { id: direccionId, entidadId, eliminadoEn: null },
  })
}

export async function getContactoDeEntidad(contactoId: number, entidadId: number) {
  return prisma.entidadContacto.findFirst({
    where: { id: contactoId, entidadId, eliminadoEn: null },
  })
}

// QAS-SI-002: la entidad productora debe estar activa (no solo no eliminada)
export async function getEntidadProductor(entidadId: number) {
  return prisma.entidad.findFirst({
    where: { id: entidadId, eliminadoEn: null, activo: true, tipos: { has: 'PRODUCTOR' } },
  })
}

export async function getUsuariosActivos(ids: string[]) {
  return prisma.usuario.findMany({
    where: { id: { in: ids }, eliminadoEn: null },
    select: { id: true, nombre: true, email: true },
  })
}

export async function getUsuarioById(id: string) {
  return prisma.usuario.findFirst({
    where: { id, eliminadoEn: null },
    select: { id: true, nombre: true, email: true },
  })
}

// QAS-SI-002: los maestros referenciados no deben estar bloqueados
export async function getMotivoActivo(motivoId: number) {
  return prisma.motivoInspeccion.findFirst({
    where: { id: motivoId, eliminadoEn: null, bloqueado: false },
  })
}

export async function getEspecieActiva(especieId: number) {
  return prisma.especie.findFirst({
    where: { id: especieId, eliminadoEn: null, bloqueado: false },
  })
}

export async function getTemporadaActiva(temporadaId: number) {
  return prisma.temporada.findFirst({
    where: { id: temporadaId, eliminadoEn: null, bloqueado: false },
  })
}

// ─── Conteo de referencias (para bloquear soft delete de maestros, QAS-SI-001) ─

export async function countSolicitudesPorCampo(
  campo: 'motivoId' | 'temporadaId' | 'especieId' | 'entidadProductorId' | 'direccionId' | 'contactoId',
  valor: number,
): Promise<number> {
  return prisma.solicitudInspeccion.count({
    where: { [campo]: valor, eliminadoEn: null },
  })
}
