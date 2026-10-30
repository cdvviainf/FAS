import { prisma } from '../../../lib/prisma.js'
import type { Prisma } from '@prisma/client'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { ConflictError } from '../../../shared/errors.js'
import type { ParCalidad } from '../../../shared/calidades-permitidas.js'
import type {
  AsignadoInput,
  EtapaAdjunto,
  SolicitudListFilters,
} from './solicitudes.types.js'

const includeDetalle = {
  temporada: { select: { id: true, codigo: true, descripcion: true } },
  usuarioSolicitante: { select: { id: true, nombre: true, email: true } },
  entidadProductor: { select: { id: true, codigo: true, descripcion: true, razonSocial: true } },
  planta: { select: { id: true, codigo: true, descripcion: true, razonSocial: true } },
  direccion: {
    select: {
      id: true,
      codigo: true,
      descripcion: true,
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
  mercado: { select: { id: true, codigo: true, descripcion: true } },
  cliente: { select: { id: true, codigo: true, descripcion: true, razonSocial: true } },
  paises: { select: { pais: { select: { id: true, codigo: true, descripcion: true } } } },
  // Detalle de producto por línea (2026-10-27): especie + embalaje + variedad +
  // categorías/calibres/calidades + cantidad de pallets.
  lineas: {
    select: {
      id: true,
      cantidadPallets: true,
      especie: { select: { id: true, codigo: true, descripcion: true } },
      variedad: { select: { id: true, codigo: true, descripcion: true } },
      articulo: { select: { id: true, codigo: true, descripcion: true } },
      categorias: { select: { categoria: { select: { id: true, codigo: true, descripcion: true } } } },
      calibres: { select: { calibre: { select: { id: true, codigo: true, descripcion: true } } } },
      calidades: {
        select: {
          notaCalidad: { select: { id: true, codigo: true, descripcion: true } },
          notaCondicion: { select: { id: true, codigo: true, descripcion: true } },
        },
      },
    },
    orderBy: { id: 'asc' as const },
  },
  asignados: {
    select: {
      id: true,
      usuarioId: true,
      funcion: true,
      usuario: { select: { id: true, nombre: true, email: true } },
    },
  },
  // Defectos del cierre (2026-10-13): grupo + defecto + valor + unidad de medida.
  defectos: {
    select: {
      id: true,
      grupoDefectoId: true,
      defectoId: true,
      valor: true,
      grupoDefecto: { select: { id: true, codigo: true, descripcion: true } },
      defecto: { select: { id: true, codigo: true, descripcion: true, tipoMedida: true } },
    },
    orderBy: { id: 'asc' as const },
  },
  // Características de madurez del cierre (2026-10-26): característica + unidad + valor.
  madurez: {
    select: {
      id: true,
      caracteristicaId: true,
      valorNumerico: true,
      valorTexto: true,
      caracteristica: {
        select: {
          id: true,
          codigo: true,
          descripcion: true,
          tipoDato: true,
          unidad: { select: { id: true, codigo: true, descripcion: true } },
        },
      },
    },
    orderBy: { id: 'asc' as const },
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
      // Orden por fecha de INGRESO (2026-10-13): `fechaHora` (visita) ahora puede
      // ser null y dejaría arriba las solicitudes sin visita (NULLS FIRST en desc).
      orderBy: { creadoEn: 'desc' },
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
  usuarioSolicitanteId: string
  entidadProductorId: number
  plantaId?: number | null
  direccionId: number
  contactoId?: number | null
  fechaHora: Date | null
  mercadoId?: number | null
  clienteId?: number | null
  fechaDespacho?: Date | null
  tipoInspeccion?: 'PRODUCTO_TERMINADO' | 'PROCESO' | null
  observaciones?: string | null
}

// Línea de producto (2026-10-27): especie + embalaje + variedad + categorías/
// calibres/calidades + cantidad de pallets.
export interface SolicitudLineaInput {
  especieId: number
  articuloId: number
  variedadId: number
  categoriaIds: number[]
  calibreIds: number[]
  calidadesPermitidas: ParCalidad[]
  cantidadPallets?: number | null
}

export interface SolicitudMultiSelects {
  paisIds: number[]
  lineas: SolicitudLineaInput[]
}

// Prisma nested-create de una línea (especie/variedad/embalaje + hijas).
function lineaCreateData(l: SolicitudLineaInput) {
  return {
    especieId: l.especieId,
    variedadId: l.variedadId,
    articuloId: l.articuloId,
    cantidadPallets: l.cantidadPallets ?? null,
    categorias: { create: l.categoriaIds.map((categoriaId) => ({ categoriaId })) },
    calibres: { create: l.calibreIds.map((calibreId) => ({ calibreId })) },
    calidades: { create: l.calidadesPermitidas.map((p) => ({ notaCalidadId: p.notaCalidadId, notaCondicionId: p.notaCondicionId })) },
  }
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
  multi: SolicitudMultiSelects,
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
        // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe
        // este valor con la empresa activa del contexto — se declara aquí
        // solo para satisfacer el tipo requerido por Prisma.
        empresaId: getEmpresaIdActual()!,
        numero,
        codigo,
        temporadaId,
        ...data,
        creadoPor: userId,
        asignados: { create: asignados },
        paises: { create: multi.paisIds.map((paisId) => ({ paisId })) },
        lineas: { create: multi.lineas.map(lineaCreateData) },
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
  multi: Partial<SolicitudMultiSelects>,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    if (asignados !== undefined) {
      await tx.solicitudInspeccionAsignado.deleteMany({ where: { solicitudId: id } })
      await tx.solicitudInspeccionAsignado.createMany({
        data: asignados.map((a) => ({ solicitudId: id, ...a })),
      })
    }
    if (multi.paisIds !== undefined) {
      await tx.solicitudInspeccionPais.deleteMany({ where: { solicitudId: id } })
      await tx.solicitudInspeccionPais.createMany({ data: multi.paisIds.map((paisId) => ({ solicitudId: id, paisId })) })
    }
    // Líneas (replace-all): borra las existentes — el Cascade elimina sus
    // categorías/calibres/calidades — y recrea cada una con sus hijas anidadas
    // (createMany no soporta writes anidados, por eso el create por línea).
    if (multi.lineas !== undefined) {
      await tx.solicitudInspeccionLinea.deleteMany({ where: { solicitudId: id } })
      for (const l of multi.lineas) {
        await tx.solicitudInspeccionLinea.create({ data: { solicitudId: id, ...lineaCreateData(l) } })
      }
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
  estadoEsperado:
    | 'PENDIENTE'
    | 'NOTIFICADA'
    | 'APROBADA'
    | 'RECHAZADA'
    | 'OBJETADA'
    | ('APROBADA' | 'RECHAZADA' | 'OBJETADA')[],
  data: Prisma.SolicitudInspeccionUpdateInput,
) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.solicitudInspeccion.updateMany({
      where: {
        id,
        estado: Array.isArray(estadoEsperado) ? { in: estadoEsperado } : estadoEsperado,
        eliminadoEn: null,
      },
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

export interface CierreData {
  comentarios: string
  resultado: 'APROBADA' | 'RECHAZADA' | 'OBJETADA'
  // Fecha/hora de la visita (2026-10-13): se fija/edita en el cierre. undefined = no tocar.
  fechaHora?: Date
  // Si vienen, reemplazan el set de asignados (incluye quién asiste = ACUDIR).
  asignados?: AsignadoInput[]
  // Si vienen, reemplazan las líneas de defecto del cierre.
  defectos?: { grupoDefectoId: number; defectoId: number; valor: number }[]
  // Si vienen, reemplazan las características de madurez del cierre (2026-10-26).
  caracteristicas?: { caracteristicaId: number; valorNumerico?: number | null; valorTexto?: string | null }[]
}

// Cierre atómico (CAS NOTIFICADA -> resultado) + fecha de visita + asignados +
// defectos, todo en una transacción (mismo criterio anti-carrera que
// transicionAtomica).
export async function cerrarSolicitud(id: number, data: CierreData, userId: string) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.solicitudInspeccion.updateMany({
      where: { id, estado: 'NOTIFICADA', eliminadoEn: null },
      data: {
        estado: data.resultado,
        comentariosCierre: data.comentarios,
        fechaCierre: new Date(),
        cerradaPor: userId,
        actualizadoPor: userId,
        ...(data.fechaHora !== undefined ? { fechaHora: data.fechaHora } : {}),
      },
    })
    if (result.count === 0) {
      throw new ConflictError(
        'La solicitud ya no está en el estado esperado: probablemente fue modificada por otro usuario. Recarga e intenta de nuevo.',
      )
    }
    if (data.asignados !== undefined) {
      await tx.solicitudInspeccionAsignado.deleteMany({ where: { solicitudId: id } })
      await tx.solicitudInspeccionAsignado.createMany({ data: data.asignados.map((a) => ({ solicitudId: id, ...a })) })
    }
    if (data.defectos !== undefined) {
      await tx.solicitudInspeccionDefecto.deleteMany({ where: { solicitudId: id } })
      if (data.defectos.length > 0) {
        await tx.solicitudInspeccionDefecto.createMany({
          data: data.defectos.map((d) => ({ solicitudId: id, grupoDefectoId: d.grupoDefectoId, defectoId: d.defectoId, valor: d.valor })),
        })
      }
    }
    if (data.caracteristicas !== undefined) {
      await tx.solicitudInspeccionMadurez.deleteMany({ where: { solicitudId: id } })
      if (data.caracteristicas.length > 0) {
        await tx.solicitudInspeccionMadurez.createMany({
          data: data.caracteristicas.map((c) => ({
            solicitudId: id,
            caracteristicaId: c.caracteristicaId,
            valorNumerico: c.valorNumerico ?? null,
            valorTexto: c.valorTexto ?? null,
          })),
        })
      }
    }
    return tx.solicitudInspeccion.findUniqueOrThrow({ where: { id }, include: includeDetalle })
  })
}

// Lookups para validar las líneas de defecto del cierre (2026-10-13), mismo
// criterio que reclamos: activos (no eliminados ni bloqueados).
export async function getGrupoDefectoActivo(id: number) {
  return prisma.grupoDefecto.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getDefectoActivo(id: number) {
  return prisma.defecto.findFirst({
    where: { id, eliminadoEn: null, bloqueado: false },
    // especies: validez por especie — un defecto sin especies es genérico.
    select: { id: true, grupoDefectoId: true, tipoMedida: true, especies: { select: { especieId: true } } },
  })
}

// Lookup para validar las características de madurez del cierre (2026-10-26):
// activa (no eliminada ni bloqueada); especies para validez por especie
// (sin especies = genérica) y tipoDato para validar el tipo de valor.
export async function getCaracteristicaMadurezActiva(id: number) {
  return prisma.caracteristicaMadurez.findFirst({
    where: { id, eliminadoEn: null, bloqueado: false },
    select: { id: true, tipoDato: true, especies: { select: { especieId: true } } },
  })
}

export async function reabrirSolicitud(id: number, userId: string) {
  // QAS-SI-004: al reabrir se limpian los datos de cierre para no dejar una
  // solicitud NOTIFICADA con evidencia de que sigue cerrada — incluye los
  // defectos registrados en el cierre (2026-10-13) y las características de
  // madurez (2026-10-26), que son evidencia de la visita cerrada. La
  // `fechaHora` (visita) NO se limpia: es editable y puede
  // haberse fijado antes del cierre.
  return prisma.$transaction(async (tx) => {
    const result = await tx.solicitudInspeccion.updateMany({
      where: { id, estado: { in: ['APROBADA', 'RECHAZADA', 'OBJETADA'] }, eliminadoEn: null },
      data: { estado: 'NOTIFICADA', comentariosCierre: null, fechaCierre: null, cerradaPor: null, actualizadoPor: userId },
    })
    if (result.count === 0) {
      throw new ConflictError(
        'La solicitud ya no está en el estado esperado: probablemente fue modificada por otro usuario. Recarga e intenta de nuevo.',
      )
    }
    await tx.solicitudInspeccionDefecto.deleteMany({ where: { solicitudId: id } })
    // Características de madurez capturadas en el cierre (2026-10-26): también
    // son evidencia de la visita cerrada; se limpian al reabrir (CM-004).
    await tx.solicitudInspeccionMadurez.deleteMany({ where: { solicitudId: id } })
    return tx.solicitudInspeccion.findUniqueOrThrow({ where: { id }, include: includeDetalle })
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

export async function getEntidadPlanta(entidadId: number) {
  return prisma.entidad.findFirst({
    where: { id: entidadId, eliminadoEn: null, activo: true, tipos: { has: 'PLANTA' } },
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

export async function getMercadoActivo(id: number) {
  return prisma.mercado.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

// El "Cliente" de la solicitud es el cliente extranjero destino de la fruta
export async function getClienteExtranjero(id: number) {
  return prisma.entidad.findFirst({
    where: { id, eliminadoEn: null, activo: true, tipos: { has: 'CLIENTE_EXTRANJERO' } },
    select: { id: true },
  })
}

export async function getNotasCalidadActivas(ids: number[]) {
  return prisma.notaCalidad.findMany({
    where: { id: { in: ids }, eliminadoEn: null, bloqueado: false },
    select: { id: true, especies: { select: { especieId: true } } },
  })
}

export async function getNotasCondicionActivas(ids: number[]) {
  return prisma.notaCondicion.findMany({
    where: { id: { in: ids }, eliminadoEn: null, bloqueado: false },
    select: { id: true, especies: { select: { especieId: true } } },
  })
}

export async function getPaisesActivos(ids: number[]) {
  return prisma.pais.findMany({ where: { id: { in: ids }, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

// Fase 2b: Pais ya no tiene mercadoId propio (ver MercadoPais) — cuenta
// cuántos de los países dados están mapeados al mercado indicado, para la
// empresa activa (tenant-scoped por la extensión de Prisma).
export async function contarPaisesEnMercado(paisIds: number[], mercadoId: number): Promise<number> {
  return prisma.mercadoPais.count({ where: { paisId: { in: paisIds }, mercadoId } })
}

export async function getVariedadesActivas(ids: number[]) {
  return prisma.variedad.findMany({ where: { id: { in: ids }, eliminadoEn: null, bloqueado: false }, select: { id: true, especieId: true } })
}

export async function getCalibresActivos(ids: number[]) {
  return prisma.calibre.findMany({ where: { id: { in: ids }, eliminadoEn: null, bloqueado: false }, select: { id: true, especieId: true } })
}

export async function getCategoriasActivas(ids: number[]) {
  return prisma.categoria.findMany({ where: { id: { in: ids }, eliminadoEn: null, bloqueado: false }, select: { id: true, especieId: true } })
}

export async function getArticulosEmbalaje(ids: number[]) {
  // especieId: los embalajes pueden ser específicos de una especie o genéricos
  // (null) — la validación por línea acepta ambos (mismo criterio que la OC).
  return prisma.articulo.findMany({ where: { id: { in: ids } }, select: { id: true, tipo: true, activo: true, especieId: true } })
}

// ─── Conteo de referencias (para bloquear soft delete de maestros, QAS-SI-001) ─

export async function countSolicitudesPorCampo(
  campo: 'temporadaId' | 'entidadProductorId' | 'direccionId' | 'contactoId',
  valor: number,
): Promise<number> {
  return prisma.solicitudInspeccion.count({
    where: { [campo]: valor, eliminadoEn: null },
  })
}
