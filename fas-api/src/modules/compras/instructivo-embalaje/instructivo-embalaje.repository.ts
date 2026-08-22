import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import type { InstructivoEmbalajeCreateInput, InstructivoEmbalajeDetalleInput, InstructivoEmbalajeUpdateInput } from './instructivo-embalaje.types.js'

const mantenedorSelect = { id: true, codigo: true, descripcion: true }
const entidadSelect = { id: true, codigo: true, descripcion: true, razonSocial: true }

const includeDetalle = {
  entidadProductor: { select: entidadSelect },
  grupoMercado: { select: mantenedorSelect },
  detalle: {
    include: {
      // etiqueta: agregada al detalle (2026-08-17) — el usuario necesita ver
      // qué Etiqueta trae cada Artículo de embalaje sin ir a Materiales.
      // kgNetoEnvase: agregado (2026-08-19) — lo usa el PDF del Instructivo
      // (documentos/resolvers/instructivo-embalaje.resolver.ts), mismo campo
      // que ya expone ordenes-compra.repository.ts para su propio PDF.
      articulo: { select: { ...mantenedorSelect, etiqueta: { select: mantenedorSelect }, kgNetoEnvase: true } },
      especie: { select: mantenedorSelect },
      variedad: { select: mantenedorSelect },
      variedadRotulada: { select: mantenedorSelect },
      categoria: { select: mantenedorSelect },
      calibres: { select: { calibre: { select: mantenedorSelect } } },
      tipoPallet: { select: mantenedorSelect },
      altura: { select: mantenedorSelect },
    },
  },
  // Inspección de Proceso (2026-08-21): folios aprobados, ordenados por
  // creación para que la UI de Calidad los muestre en el orden en que se
  // cargaron.
  folios: {
    select: { id: true, folio: true, estado: true, palletId: true, creadoEn: true },
    orderBy: { id: 'asc' as const },
  },
}

export async function listInstructivos(
  page: number,
  limit: number,
  entidadProductorId?: number,
  estadoInspeccion?: 'PENDIENTE' | 'NOTIFICADA' | 'APROBADA' | 'RECHAZADA' | 'CERRADA',
) {
  const where = {
    eliminadoEn: null,
    ...(entidadProductorId ? { entidadProductorId } : {}),
    ...(estadoInspeccion ? { estadoInspeccion } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.instructivoEmbalaje.findMany({
      where,
      include: {
        entidadProductor: { select: entidadSelect },
        grupoMercado: { select: mantenedorSelect },
        _count: { select: { folios: true } },
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
  return prisma.instructivoEmbalaje.findFirst({ where: { id, eliminadoEn: null }, include: includeDetalle })
}

// Transición de estado atómica y condicionada al estado actual
// (FAS-INSP-1A-002, QA ronda 1): el WHERE incluye los estados permitidos, así
// que dos transiciones concurrentes (p.ej. aprobar y rechazar a la vez) no
// pueden leer el mismo estado inicial y pisarse — Postgres serializa la fila
// en la propia sentencia UPDATE. `count === 0` significa "no existe" o
// "estado inválido"; el service decide cuál con una consulta de seguimiento.
// No cubre CERRADA — cerrar exige folios cargados, ver cerrarInspeccionSiCorresponde.
export async function updateEstadoInspeccionCondicional(
  id: number,
  estadosPermitidos: Array<'PENDIENTE' | 'NOTIFICADA'>,
  data: {
    estadoInspeccion: 'NOTIFICADA' | 'APROBADA' | 'RECHAZADA'
    notificadaEn?: Date
    comentarioInspeccion?: string | null
    inspeccionadoEn?: Date
    inspeccionadoPor?: string
  },
) {
  const result = await prisma.instructivoEmbalaje.updateMany({
    where: { id, eliminadoEn: null, estadoInspeccion: { in: estadosPermitidos } },
    data,
  })
  return result.count
}

type CerrarInspeccionResultado =
  | { estado: 'OK'; instructivo: NonNullable<Awaited<ReturnType<typeof getInstructivoById>>> }
  | { estado: 'NO_ENCONTRADO' }
  | { estado: 'ESTADO_INVALIDO' }
  | { estado: 'SIN_FOLIOS' }

// Cierre atómico condicionado a APROBADA + al menos 1 folio cargado
// (FAS-INSP-1A-002 + decisión de negocio 2026-08-21): el reclamo de estado y
// el conteo de folios corren en la misma transacción que la transición a
// CERRADA — el UPDATE de reclamo mantiene la fila bloqueada hasta el commit,
// así ninguna carga/eliminación de folios concurrente puede colarse entre el
// conteo y el cierre (y viceversa: addFoliosSiAprobada/deleteFolioSiAprobada
// usan el mismo reclamo, así que esperan a que esta transacción termine y
// luego ven CERRADA).
export async function cerrarInspeccionSiCorresponde(id: number): Promise<CerrarInspeccionResultado> {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.instructivoEmbalaje.updateMany({
      where: { id, eliminadoEn: null, estadoInspeccion: 'APROBADA' },
      data: { estadoInspeccion: 'APROBADA' },
    })
    if (claim.count === 0) {
      const existe = await tx.instructivoEmbalaje.findFirst({ where: { id, eliminadoEn: null }, select: { id: true } })
      return { estado: existe ? 'ESTADO_INVALIDO' : 'NO_ENCONTRADO' }
    }

    const folios = await tx.instructivoEmbalajeFolio.count({ where: { instructivoId: id } })
    if (folios === 0) return { estado: 'SIN_FOLIOS' }

    const instructivo = await tx.instructivoEmbalaje.update({
      where: { id },
      data: { estadoInspeccion: 'CERRADA' },
      include: includeDetalle,
    })
    return { estado: 'OK', instructivo }
  })
}

// ─── Folios (números de pallet aprobados) ───────────────────────────────────

// Folios de esta empresa que colisionan con los propuestos (unicidad
// sistémica por empresa — la extensión de tenancy inyecta el empresaId).
export async function getFoliosColisionados(folios: string[]) {
  return prisma.instructivoEmbalajeFolio.findMany({
    where: { folio: { in: folios } },
    select: { folio: true },
  })
}

// Carga de folios atómica y condicionada a APROBADA (FAS-INSP-1A-002): el
// "reclamo" (updateMany con WHERE de estado) y el createMany de folios
// corren en la misma transacción, así un `cerrar` concurrente no puede
// colarse entre el check de estado y la escritura de folios. `null` si el
// reclamo no afectó fila (no existe, eliminado, o estado != APROBADA).
export async function addFoliosSiAprobada(instructivoId: number, folios: string[], creadoPor: string) {
  const empresaId = getEmpresaIdActual()!
  return prisma.$transaction(async (tx) => {
    const claim = await tx.instructivoEmbalaje.updateMany({
      where: { id: instructivoId, eliminadoEn: null, estadoInspeccion: 'APROBADA' },
      data: { estadoInspeccion: 'APROBADA' },
    })
    if (claim.count === 0) return null

    await tx.instructivoEmbalajeFolio.createMany({
      // empresaId se declara explícito (igual que createInstructivo); la
      // extensión de tenancy (prisma-tenancy.ts) igual lo fuerza a la empresa
      // activa del contexto.
      data: folios.map((folio) => ({ empresaId, instructivoId, folio, creadoPor })),
    })
    return tx.instructivoEmbalaje.findFirst({ where: { id: instructivoId }, include: includeDetalle })
  })
}

type QuitarFolioResultado =
  | { ok: true }
  | { ok: false; motivo: 'ESTADO' | 'NO_ENCONTRADO' | 'RECEPCIONADO' }

// Eliminación de folio atómica y condicionada a APROBADA (FAS-INSP-1A-002):
// mismo patrón de reclamo + operación en una sola transacción que
// addFoliosSiAprobada, para que un `cerrar` concurrente no se cuele entre el
// check de estado y el delete del folio.
export async function deleteFolioSiAprobada(instructivoId: number, folioId: number): Promise<QuitarFolioResultado> {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.instructivoEmbalaje.updateMany({
      where: { id: instructivoId, eliminadoEn: null, estadoInspeccion: 'APROBADA' },
      data: { estadoInspeccion: 'APROBADA' },
    })
    if (claim.count === 0) return { ok: false, motivo: 'ESTADO' }

    const folio = await tx.instructivoEmbalajeFolio.findFirst({
      where: { id: folioId },
      select: { id: true, instructivoId: true, estado: true },
    })
    if (!folio || folio.instructivoId !== instructivoId) return { ok: false, motivo: 'NO_ENCONTRADO' }
    if (folio.estado === 'RECEPCIONADO') return { ok: false, motivo: 'RECEPCIONADO' }

    await tx.instructivoEmbalajeFolio.delete({ where: { id: folioId } })
    return { ok: true }
  })
}

// Soft delete atómico y condicionado a "sin veredicto" (FAS-INSP-1A-002):
// mismo criterio de congelamiento que updateInstructivoSiEditable. Retorna la
// cantidad de filas afectadas (0 = no existe, ya eliminado, o ya tiene
// veredicto).
export async function softDeleteInstructivoSiEditable(id: number, eliminadoPor: string) {
  const result = await prisma.instructivoEmbalaje.updateMany({
    where: {
      id,
      eliminadoEn: null,
      estadoInspeccion: { notIn: ['APROBADA', 'RECHAZADA', 'CERRADA'] },
    },
    data: { eliminadoEn: new Date(), eliminadoPor },
  })
  return result.count
}

const LOCK_NAMESPACE_INSTRUCTIVO_EMBALAJE = 490235

export async function createInstructivo(body: InstructivoEmbalajeCreateInput, creadoPor: string) {
  const { detalle, ...resto } = body
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
        ...resto,
        creadoPor,
        detalle: {
          create: detalle.map(({ calibreIds, ...lineaResto }) => ({
            ...lineaResto,
            calibres: { create: calibreIds.map((calibreId) => ({ calibreId })) },
          })),
        },
      },
      include: includeDetalle,
    })
  })
}

// Reemplazo atómico y condicionado a "sin veredicto" (FAS-INSP-1A-002): la
// fila se bloquea con el propio UPDATE de "reclamo" (SET eliminadoEn = NULL,
// no-op semántico — siempre ya es NULL por el WHERE) antes de aplicar el
// resto de los cambios, así una edición concurrente con un veredicto no
// puede colarse entre el check de estado y la escritura. Si viene `detalle`,
// se dropea toda la línea previa y se recrea completa (mismo patrón que
// `calibres: { deleteMany, create }` en ordenes-compra.repository.ts
// updateLinea) — el Instructivo se crea/edita como documento completo, no
// por línea individual (a diferencia de la OC). `null` si el reclamo no
// afectó fila (no existe, eliminado, o ya tiene veredicto).
export async function updateInstructivoSiEditable(id: number, data: InstructivoEmbalajeUpdateInput) {
  const { detalle, ...resto } = data
  return prisma.$transaction(async (tx) => {
    const claim = await tx.instructivoEmbalaje.updateMany({
      where: {
        id,
        eliminadoEn: null,
        estadoInspeccion: { notIn: ['APROBADA', 'RECHAZADA', 'CERRADA'] },
      },
      data: { eliminadoEn: null },
    })
    if (claim.count === 0) return null

    return tx.instructivoEmbalaje.update({
      where: { id },
      data: {
        ...resto,
        ...(detalle
          ? {
              detalle: {
                deleteMany: {},
                create: detalle.map(({ calibreIds, ...linea }) => ({
                  ...linea,
                  calibres: { create: calibreIds.map((calibreId) => ({ calibreId })) },
                })),
              },
            }
          : {}),
      },
      include: includeDetalle,
    })
  })
}

export async function getEntidadProductor(id: number) {
  return prisma.entidad.findFirst({
    where: { id, eliminadoEn: null, activo: true },
    select: { id: true, tipos: true },
  })
}

export async function getGrupoMercado(id: number) {
  return prisma.grupoMercado.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
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

export async function getAltura(id: number) {
  return prisma.altura.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}
