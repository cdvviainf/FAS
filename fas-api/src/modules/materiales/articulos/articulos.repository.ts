import { prisma } from '../../../lib/prisma.js'
import type { Prisma, TipoArticulo } from '@prisma/client'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import type { ArticuloCreateInput, ArticuloUpdateInput, ArticuloListFilters } from './articulos.types.js'

const unidadSelect = { id: true, codigo: true, descripcion: true }
const etiquetaSelect = { id: true, codigo: true, descripcion: true }
const especieSelect = { id: true, codigo: true, descripcion: true }

function buildWhere(filters: ArticuloListFilters): Prisma.ArticuloWhereInput {
  const and: Prisma.ArticuloWhereInput[] = []
  if (filters.q) {
    and.push({
      OR: [
        { codigo: { contains: filters.q, mode: 'insensitive' as const } },
        { descripcion: { contains: filters.q, mode: 'insensitive' as const } },
      ],
    })
  }
  // Filtro por especie (2026-10-05): incluye los embalajes de la especie pedida
  // Y los genéricos (sin especie asignada) — así no se ocultan embalajes que hoy
  // no tienen especie. Se combina con el OR de `q` vía AND para no pisarlo.
  if (filters.especieId != null) {
    and.push({ OR: [{ especieId: filters.especieId }, { especieId: null }] })
  }
  return {
    ...(filters.tipo ? { tipo: filters.tipo } : {}),
    ...(filters.activo !== undefined ? { activo: filters.activo } : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  }
}

// Orden explícito pedido por el usuario (header clicable) — mismo patrón que
// embarques.repository.ts:resolveOrderByEmbarque.
function resolveOrderByArticulo(sort?: string): Prisma.ArticuloOrderByWithRelationInput[] {
  if (sort) {
    try {
      const arr = JSON.parse(sort) as Array<{ id: string; desc: boolean }>
      const first = Array.isArray(arr) ? arr[0] : null
      if (first?.id) {
        const dir = first.desc ? 'desc' : 'asc'
        switch (first.id) {
          case 'codigo': return [{ codigo: dir }]
          case 'descripcion': return [{ descripcion: dir }]
          case 'tipo': return [{ tipo: dir }]
          case 'unidad': return [{ unidad: { descripcion: dir } }]
          case 'especie': return [{ especie: { descripcion: dir } }]
          case 'activo': return [{ activo: dir }]
        }
      }
    } catch {
      /* sort inválido: orden por defecto */
    }
  }
  return [{ codigo: 'asc' }]
}

export async function listArticulos(filters: ArticuloListFilters) {
  const { page = 1, limit = 20 } = filters
  const where = buildWhere(filters)
  const [data, total] = await Promise.all([
    prisma.articulo.findMany({
      where,
      include: {
        unidad: { select: unidadSelect },
        etiqueta: { select: etiquetaSelect },
        especie: { select: especieSelect },
        // Conjunto permitido del embalaje (2026-10-12): lo usa el editor de
        // Stock para limitar/bloquear la etiqueta por línea.
        etiquetasAdicionales: { select: { etiquetaId: true, etiqueta: { select: etiquetaSelect } }, orderBy: { id: 'asc' } },
      },
      orderBy: resolveOrderByArticulo(filters.sort),
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.articulo.count({ where }),
  ])
  return { data, total }
}

export async function getArticuloById(id: number) {
  return prisma.articulo.findUnique({
    where: { id },
    include: {
      unidad: { select: unidadSelect },
      etiqueta: { select: etiquetaSelect },
      especie: { select: especieSelect },
      codigosEquivalentes: { select: { id: true, codigo: true, descripcion: true }, orderBy: { id: 'asc' } },
      etiquetasAdicionales: { select: { etiquetaId: true, etiqueta: { select: etiquetaSelect } }, orderBy: { id: 'asc' } },
      saldos: {
        include: { bodega: { select: { id: true, codigo: true, descripcion: true } } },
      },
    },
  })
}

export async function findArticuloByCodigo(codigo: string) {
  return prisma.articulo.findFirst({ where: { codigo } })
}

// Artículos de ciertos tipos para las hojas de referencia / dropdowns y el
// ejemplo del template de Carga de Recetas: solo código + descripción + tipo,
// ordenados por código. NO filtra por `activo` a propósito: el cargador de
// recetas acepta cualquier artículo del tipo correcto sin mirar su estado, así
// que la referencia debe mostrar lo mismo que el loader admite (FAS-REC-TPL-002).
// Tenant-scoped vía el Prisma Client Extension.
export async function findArticulosParaReferencia(tipos: TipoArticulo[]) {
  return prisma.articulo.findMany({
    where: { tipo: { in: tipos } },
    select: { codigo: true, descripcion: true, tipo: true },
    orderBy: { codigo: 'asc' },
  })
}

// ART-04: valida que la unidad de medida exista, no esté eliminada ni bloqueada
export async function getUnidadMedidaActiva(unidadId: number) {
  return prisma.unidadMedida.findFirst({
    where: { id: unidadId, eliminadoEn: null, bloqueado: false },
  })
}

// Valida que la etiqueta exista, no esté eliminada ni bloqueada (requerida
// solo si tipo=EMBALAJE, ver articulos.service.ts).
export async function getEtiquetaActiva(etiquetaId: number) {
  return prisma.etiqueta.findFirst({
    where: { id: etiquetaId, eliminadoEn: null, bloqueado: false },
  })
}

const articuloInclude = {
  unidad: { select: unidadSelect },
  etiqueta: { select: etiquetaSelect },
  especie: { select: especieSelect },
  codigosEquivalentes: { select: { id: true, codigo: true, descripcion: true }, orderBy: { id: 'asc' as const } },
  etiquetasAdicionales: { select: { etiquetaId: true, etiqueta: { select: etiquetaSelect } }, orderBy: { id: 'asc' as const } },
}

function nestedCodigos(codigos: ArticuloCreateInput['codigosEquivalentes']) {
  return (codigos ?? []).map((c) => ({ codigo: c.codigo, descripcion: c.descripcion ?? null }))
}

function nestedEtiquetas(ids: number[] | undefined) {
  return (ids ?? []).map((etiquetaId) => ({ etiquetaId }))
}

export async function createArticulo(data: ArticuloCreateInput) {
  const { codigosEquivalentes, etiquetaIdsAdicionales, ...scalar } = data
  return prisma.articulo.create({
    // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe este
    // valor con la empresa activa del contexto — se declara aquí solo para
    // satisfacer el tipo requerido por Prisma.
    data: {
      ...scalar,
      empresaId: getEmpresaIdActual()!,
      ...(codigosEquivalentes && codigosEquivalentes.length > 0
        ? { codigosEquivalentes: { create: nestedCodigos(codigosEquivalentes) } }
        : {}),
      ...(etiquetaIdsAdicionales && etiquetaIdsAdicionales.length > 0
        ? { etiquetasAdicionales: { create: nestedEtiquetas(etiquetaIdsAdicionales) } }
        : {}),
    },
    include: articuloInclude,
  })
}

export async function updateArticulo(id: number, data: ArticuloUpdateInput) {
  const { codigosEquivalentes, etiquetaIdsAdicionales, ...scalar } = data
  // Si `codigosEquivalentes` o `etiquetaIdsAdicionales` vienen definidas,
  // reemplazan toda la lista (borra + recrea) en una transacción; si son
  // undefined, no se tocan.
  if (codigosEquivalentes !== undefined || etiquetaIdsAdicionales !== undefined) {
    return prisma.$transaction(async (tx) => {
      if (codigosEquivalentes !== undefined) {
        await tx.articuloCodigoEquivalente.deleteMany({ where: { articuloId: id } })
      }
      if (etiquetaIdsAdicionales !== undefined) {
        await tx.articuloEtiqueta.deleteMany({ where: { articuloId: id } })
      }
      return tx.articulo.update({
        where: { id },
        data: {
          ...scalar,
          ...(codigosEquivalentes && codigosEquivalentes.length > 0 ? { codigosEquivalentes: { create: nestedCodigos(codigosEquivalentes) } } : {}),
          ...(etiquetaIdsAdicionales && etiquetaIdsAdicionales.length > 0 ? { etiquetasAdicionales: { create: nestedEtiquetas(etiquetaIdsAdicionales) } } : {}),
        },
        include: articuloInclude,
      })
    })
  }
  return prisma.articulo.update({ where: { id }, data: scalar, include: articuloInclude })
}

// ─── Documentos adjuntos ─────────────────────────────────────────────────────

export async function createDocumento(
  articuloId: number,
  meta: { nombre: string; mime: string; tamano: number },
  datos: Buffer,
  subidoPor: string,
) {
  return prisma.documentoArticulo.create({
    data: {
      articuloId,
      ...meta,
      subidoPor,
      contenido: { create: { datos } },
    },
    select: { id: true, nombre: true, mime: true, tamano: true, subidoPor: true, creadoEn: true },
  })
}

export async function listDocumentos(articuloId: number) {
  return prisma.documentoArticulo.findMany({
    where: { articuloId },
    select: { id: true, nombre: true, mime: true, tamano: true, subidoPor: true, creadoEn: true },
    orderBy: { creadoEn: 'asc' },
  })
}

export async function getDocumentoMeta(articuloId: number, documentoId: number) {
  return prisma.documentoArticulo.findFirst({ where: { id: documentoId, articuloId } })
}

export async function getDocumentoContenido(documentoId: number) {
  return prisma.documentoArticuloContenido.findUnique({ where: { documentoId } })
}

export async function deleteDocumento(documentoId: number) {
  return prisma.documentoArticulo.delete({ where: { id: documentoId } })
}
