import { prisma } from '../../lib/prisma.js'
import type { MantenedorModelo, MantenedorListFilters, MantenedorCreateInput, BodegaContactoInput } from './config.types.js'

// Mapeo de modelo a nombre de delegado en Prisma Client
const modelMap: Record<MantenedorModelo, string> = {
  pais: 'pais',
  zona: 'zona',
  grupoMercado: 'grupoMercado',
  tipoEmbarque: 'tipoEmbarque',
  unidadMedida: 'unidadMedida',
  tipoPallet: 'tipoPallet',
  altura: 'altura',
  tipoProduccion: 'tipoProduccion',
  tipoDefecto: 'tipoDefecto',
  tipoParametro: 'tipoParametro',
  // Con FK
  region: 'region',
  provincia: 'provincia',
  comuna: 'comuna',
  especie: 'especie',
  grupoVariedad: 'grupoVariedad',
  variedad: 'variedad',
  categoria: 'categoria',
  calibre: 'calibre',
  parametro: 'parametro',
  mercado: 'mercado',
  // Lote 3
  puerto: 'puerto',
  moneda: 'moneda',
  conceptoCtaCte: 'conceptoCtaCte',
  // Lote 4
  temporada: 'temporada',
  bodega: 'bodega',
}

// Qué campos include para modelos con FK (para exponer datos relacionados)
const includeMap: Partial<Record<MantenedorModelo, object>> = {
  provincia: { region: { select: { id: true, descripcion: true } } },
  comuna: { provincia: { select: { id: true, descripcion: true, region: { select: { id: true, descripcion: true } } } } },
  especie: { unidadMedidaCalidad: { select: { id: true, descripcion: true, codigo: true } } },
  grupoVariedad: { especie: { select: { id: true, descripcion: true } } },
  variedad: {
    especie: { select: { id: true, descripcion: true } },
    grupoVariedad: { select: { id: true, descripcion: true } },
  },
  categoria: { especie: { select: { id: true, descripcion: true } } },
  calibre: { especie: { select: { id: true, descripcion: true } } },
  parametro: { tipoParametro: { select: { id: true, descripcion: true } } },
  mercado: {
    grupoMercado: { select: { id: true, descripcion: true } },
    pais: { select: { id: true, descripcion: true, codigo: true } },
  },
  puerto: {
    pais: { select: { id: true, descripcion: true, codigo: true, esPaisOrigen: true } },
    tipoEmbarque: { select: { id: true, descripcion: true } },
  },
  bodega: {
    comuna: {
      select: {
        id: true,
        descripcion: true,
        provincia: { select: { id: true, descripcion: true, region: { select: { id: true, descripcion: true } } } },
      },
    },
    contactos: {
      select: { id: true, nombre: true, email: true, telefono: true, orden: true },
      orderBy: { orden: 'asc' as const },
    },
  },
}

// FK filter fields per model
type FkFilterKey = 'regionId' | 'provinciaId' | 'especieId' | 'grupoVariedadId' | 'tipoParametroId' | 'grupoMercadoId' | 'paisId' | 'tipoEmbarqueId' | 'comunaId'

const fkFilterMap: Partial<Record<MantenedorModelo, FkFilterKey[]>> = {
  provincia: ['regionId'],
  comuna: ['provinciaId'],
  grupoVariedad: ['especieId'],
  variedad: ['especieId', 'grupoVariedadId'],
  categoria: ['especieId'],
  calibre: ['especieId'],
  parametro: ['tipoParametroId'],
  mercado: ['grupoMercadoId', 'paisId'],
  puerto: ['paisId', 'tipoEmbarqueId'],
  bodega: ['comunaId'],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDelegate(modelo: MantenedorModelo): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as unknown as Record<string, any>)[modelMap[modelo]]
}

export async function listMantenedor(modelo: MantenedorModelo, filters: MantenedorListFilters) {
  const { q, page = 1, limit = 20, soloActivos } = filters

  // Build FK filters
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fkWhere: Record<string, any> = {}
  const allowedFkFields = fkFilterMap[modelo] ?? []
  for (const field of allowedFkFields) {
    if (filters[field] !== undefined) {
      fkWhere[field] = filters[field]
    }
  }

  // R9: Puerto con contexto=origen solo devuelve puertos de países con esPaisOrigen=true
  const contextoWhere =
    modelo === 'puerto' && filters.contexto === 'origen'
      ? { pais: { esPaisOrigen: true } }
      : {}

  const where = {
    eliminadoEn: null,
    ...(soloActivos ? { bloqueado: false } : {}),
    ...fkWhere,
    ...contextoWhere,
    ...(q
      ? {
          OR: [
            { descripcion: { contains: q, mode: 'insensitive' as const } },
            { codigo: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const delegate = getDelegate(modelo)
  const includeClause = includeMap[modelo]

  const [data, total] = await Promise.all([
    delegate.findMany({
      where,
      orderBy: { codigo: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      ...(includeClause ? { include: includeClause } : {}),
    }),
    delegate.count({ where }),
  ])
  return { data, total }
}

export async function getMantenedorById(modelo: MantenedorModelo, id: number) {
  const includeClause = includeMap[modelo]
  return getDelegate(modelo).findFirst({
    where: { id, eliminadoEn: null },
    ...(includeClause ? { include: includeClause } : {}),
  })
}

export async function findMantenedorByCodigo(
  modelo: MantenedorModelo,
  codigo: string,
  excludeId?: number,
) {
  return getDelegate(modelo).findFirst({
    where: {
      codigo: { equals: codigo, mode: 'insensitive' as const },
      eliminadoEn: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  })
}

export async function findMantenedorByOrden(
  modelo: 'categoria' | 'calibre',
  especieId: number,
  orden: number,
  excludeId?: number,
) {
  return getDelegate(modelo).findFirst({
    where: {
      especieId,
      orden,
      eliminadoEn: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  })
}

export async function countChildren(
  modelo: MantenedorModelo,
  parentId: number,
  parentField: string,
): Promise<number> {
  return getDelegate(modelo).count({
    where: {
      [parentField]: parentId,
      eliminadoEn: null,
    },
  })
}

export async function createMantenedor(
  modelo: MantenedorModelo,
  data: MantenedorCreateInput,
  userId: string,
) {
  return getDelegate(modelo).create({
    data: {
      ...data,
      creadoPor: userId,
    },
  })
}

export async function updateMantenedor(
  modelo: MantenedorModelo,
  id: number,
  data: Partial<MantenedorCreateInput>,
  userId: string,
) {
  return getDelegate(modelo).update({
    where: { id },
    data: {
      ...data,
      actualizadoPor: userId,
    },
  })
}

export async function findTemporadaOverlap(
  fechaInicio: Date,
  fechaTermino: Date,
  excludeId?: number,
) {
  return prisma.temporada.findFirst({
    where: {
      eliminadoEn: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
      AND: [
        { fechaInicio: { lte: fechaTermino } },
        { fechaTermino: { gte: fechaInicio } },
      ],
    },
  })
}

export async function clearMonedaBase(excludeId?: number) {
  await prisma.moneda.updateMany({
    where: {
      esMonedaBase: true,
      eliminadoEn: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    data: { esMonedaBase: false },
  })
}

export async function countMonedaBase(excludeId?: number): Promise<number> {
  return prisma.moneda.count({
    where: {
      esMonedaBase: true,
      eliminadoEn: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  })
}

export async function softDeleteMantenedor(
  modelo: MantenedorModelo,
  id: number,
  userId: string,
) {
  return getDelegate(modelo).update({
    where: { id },
    data: {
      eliminadoEn: new Date(),
      eliminadoPor: userId,
    },
  })
}

// ─── Temporada predeterminada ────────────────────────────────────────────────

export async function getTemporadaPredeterminada() {
  return prisma.temporada.findFirst({
    where: { predeterminada: true, eliminadoEn: null },
  })
}

export async function clearTemporadaPredeterminada(excludeId?: number) {
  await prisma.temporada.updateMany({
    where: {
      predeterminada: true,
      eliminadoEn: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    data: { predeterminada: false },
  })
}

export async function countTemporadaPredeterminada(excludeId?: number): Promise<number> {
  return prisma.temporada.count({
    where: {
      predeterminada: true,
      eliminadoEn: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  })
}

// ─── Bodega contactos ────────────────────────────────────────────────────────

export async function createBodegaContactos(bodegaId: number, contactos: BodegaContactoInput[]) {
  if (contactos.length === 0) return
  await prisma.bodegaContacto.createMany({
    data: contactos.map((c, idx) => ({
      bodegaId,
      nombre: c.nombre,
      email: c.email || undefined,
      telefono: c.telefono || undefined,
      orden: c.orden ?? idx,
    })),
  })
}

export async function updateBodegaConContactos(
  bodegaId: number,
  data: Partial<MantenedorCreateInput>,
  contactos: BodegaContactoInput[],
  userId: string,
) {
  const { contactos: _c, tipos, comunaId, ...scalarData } = data as Partial<MantenedorCreateInput>

  return prisma.$transaction(async (tx) => {
    await tx.bodega.update({
      where: { id: bodegaId },
      data: {
        ...scalarData,
        ...(comunaId !== undefined ? { comunaId } : {}),
        ...(tipos !== undefined ? { tipos: tipos as ('MATERIALES' | 'EMBARQUE' | 'DESPACHO')[] } : {}),
        actualizadoPor: userId,
      },
    })

    await tx.bodegaContacto.deleteMany({ where: { bodegaId } })
    if (contactos.length > 0) {
      await tx.bodegaContacto.createMany({
        data: contactos.map((c, idx) => ({
          bodegaId,
          nombre: c.nombre,
          email: c.email || undefined,
          telefono: c.telefono || undefined,
          orden: c.orden ?? idx,
        })),
      })
    }

    return prisma.bodega.findFirst({
      where: { id: bodegaId },
      include: {
        comuna: {
          select: {
            id: true,
            descripcion: true,
            provincia: { select: { id: true, descripcion: true, region: { select: { id: true, descripcion: true } } } },
          },
        },
        contactos: {
          select: { id: true, nombre: true, email: true, telefono: true, orden: true },
          orderBy: { orden: 'asc' },
        },
      },
    })
  })
}
