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
}

export async function listInstructivos(page: number, limit: number, entidadProductorId?: number) {
  const where = {
    eliminadoEn: null,
    ...(entidadProductorId ? { entidadProductorId } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.instructivoEmbalaje.findMany({
      where,
      include: {
        entidadProductor: { select: entidadSelect },
        grupoMercado: { select: mantenedorSelect },
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

// Soft delete — sin condición de estado (2026-09-02: el Instructivo ya no
// tiene veredicto de Calidad que lo congele, ver compras.md §4.1).
export async function softDeleteInstructivo(id: number, eliminadoPor: string) {
  const result = await prisma.instructivoEmbalaje.updateMany({
    where: { id, eliminadoEn: null },
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

// Reemplazo atómico — sin condición de estado (2026-09-02, ver
// softDeleteInstructivo arriba). Si viene `detalle`, se dropea toda la línea
// previa y se recrea completa (mismo patrón que `calibres: { deleteMany,
// create }` en ordenes-compra.repository.ts updateLinea) — el Instructivo se
// crea/edita como documento completo, no por línea individual (a diferencia
// de la OC).
export async function updateInstructivo(id: number, data: InstructivoEmbalajeUpdateInput) {
  const { detalle, ...resto } = data
  return prisma.$transaction(async (tx) => {
    const claim = await tx.instructivoEmbalaje.updateMany({ where: { id, eliminadoEn: null }, data: {} })
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
