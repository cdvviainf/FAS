import { prisma } from '../../lib/prisma.js'
import { getEmpresaIdActual } from '../../lib/empresa-context.js'
import type { MantenedorModelo, MantenedorListFilters, MantenedorCreateInput, BodegaContactoInput } from './config.types.js'

// Mapeo de modelo a nombre de delegado en Prisma Client
const modelMap: Record<MantenedorModelo, string> = {
  pais: 'pais',
  zona: 'zona',
  grupoMercado: 'grupoMercado',
  tipoEmbarque: 'tipoEmbarque',
  formaPago: 'formaPago',
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
  // Lote 6 — Calidad
  calificacion: 'calificacion',
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
  },
  // pais: manejo dedicado en listPaises/getPaisById — su "mercado" ya no es
  // una FK directa (ver MercadoPais, Fase 2b) y necesita filtrarse por la
  // empresa activa, algo que el includeMap genérico no resuelve.
  puerto: {
    pais: { select: { id: true, descripcion: true, codigo: true, puedeSerOrigen: true } },
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
type FkFilterKey = 'regionId' | 'provinciaId' | 'especieId' | 'grupoVariedadId' | 'tipoParametroId' | 'grupoMercadoId' | 'paisId' | 'tipoEmbarqueId' | 'comunaId' | 'mercadoId'

const fkFilterMap: Partial<Record<MantenedorModelo, FkFilterKey[]>> = {
  provincia: ['regionId'],
  comuna: ['provinciaId'],
  grupoVariedad: ['especieId'],
  variedad: ['especieId', 'grupoVariedadId'],
  categoria: ['especieId'],
  calibre: ['especieId'],
  parametro: ['tipoParametroId'],
  mercado: ['grupoMercadoId'],
  puerto: ['paisId', 'tipoEmbarqueId'],
  bodega: ['comunaId'],
  // pais.mercadoId: manejo dedicado en listPaises (ya no es una FK directa).
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDelegate(modelo: MantenedorModelo): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as unknown as Record<string, any>)[modelMap[modelo]]
}

export async function listMantenedor(modelo: MantenedorModelo, filters: MantenedorListFilters) {
  if (modelo === 'pais') return listPaises(filters)

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

  // R9: Puerto con contexto=origen solo devuelve puertos de países con puedeSerOrigen=true
  const contextoWhere =
    modelo === 'puerto' && filters.contexto === 'origen'
      ? { pais: { puedeSerOrigen: true } }
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
  if (modelo === 'pais') return getPaisById(id)

  const includeClause = includeMap[modelo]
  return getDelegate(modelo).findFirst({
    where: { id, eliminadoEn: null },
    ...(includeClause ? { include: includeClause } : {}),
  })
}

// ─── Pais ↔ Mercado (Fase 2b) ────────────────────────────────────────────────
// Pais ya no tiene mercadoId propio (ver MercadoPais). Los reads anidados NO
// pasan por la extensión de tenancy (riesgo residual documentado en
// Docs/empresas.md §2.c) — el filtro por empresa activa se agrega a mano acá,
// con -1 como centinela cuando no hay empresa resuelta (sin coincidencias,
// en vez de reventar la consulta).
// mercadoId se reconstruye además de `mercado` porque el form de edición del
// frontend (pais-form-sheet.tsx) precarga el select leyendo `item.mercadoId`
// directamente — mismo contrato que cuando era una columna propia.
type PaisConMercado = { mercadoId: number | null; mercado: { id: number; descripcion: string } | null }

function aplanarMercado<T extends { mercadoPaises: { mercadoId: number; mercado: { id: number; descripcion: string } }[] }>(
  pais: T,
): Omit<T, 'mercadoPaises'> & PaisConMercado {
  const { mercadoPaises, ...resto } = pais
  return { ...resto, mercadoId: mercadoPaises[0]?.mercadoId ?? null, mercado: mercadoPaises[0]?.mercado ?? null }
}

async function listPaises(filters: MantenedorListFilters) {
  const { q, page = 1, limit = 20, soloActivos, mercadoId } = filters
  const empresaId = getEmpresaIdActual() ?? -1

  const where = {
    eliminadoEn: null,
    ...(soloActivos ? { bloqueado: false } : {}),
    ...(mercadoId != null ? { mercadoPaises: { some: { empresaId, mercadoId } } } : {}),
    ...(q
      ? {
          OR: [
            { descripcion: { contains: q, mode: 'insensitive' as const } },
            { codigo: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const includeMercadoActivo = {
    mercadoPaises: {
      where: { empresaId },
      select: { mercadoId: true, mercado: { select: { id: true, descripcion: true } } },
    },
  }

  const [rows, total] = await Promise.all([
    prisma.pais.findMany({
      where,
      orderBy: { codigo: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: includeMercadoActivo,
    }),
    prisma.pais.count({ where }),
  ])

  return { data: rows.map(aplanarMercado), total }
}

async function getPaisById(id: number) {
  const empresaId = getEmpresaIdActual() ?? -1
  const row = await prisma.pais.findFirst({
    where: { id, eliminadoEn: null },
    include: {
      mercadoPaises: {
        where: { empresaId },
        select: { mercadoId: true, mercado: { select: { id: true, descripcion: true } } },
      },
    },
  })
  return row ? aplanarMercado(row) : null
}

export async function upsertMercadoPais(paisId: number, mercadoId: number, userId: string) {
  // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe este
  // valor con el resuelto en el request (o lanza EMPRESA_REQUERIDA si no hay
  // ninguno) — el valor acá solo satisface el tipo generado por Prisma.
  const empresaId = getEmpresaIdActual()!
  return prisma.mercadoPais.upsert({
    where: { empresaId_paisId: { empresaId, paisId } },
    create: { empresaId, paisId, mercadoId, creadoPor: userId },
    update: { mercadoId, actualizadoPor: userId },
  })
}

export async function countPaisesPorMercado(mercadoId: number): Promise<number> {
  // R8: solo países vigentes (no soft-deleted) bloquean el borrado del mercado.
  return prisma.mercadoPais.count({ where: { mercadoId, pais: { eliminadoEn: null } } })
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

export async function countActiveReferences(
  delegateName:
    | 'entidad'
    | 'entidadDireccion'
    | 'bodegaContacto'
    | 'solicitudInspeccion'
    | 'solicitudInspeccionPais'
    | 'solicitudInspeccionVariedad'
    | 'solicitudInspeccionCalibre'
    | 'solicitudInspeccionCategoria'
    | 'solicitudInspeccionEmbalaje',
  parentId: number,
  parentField: string,
  usesSoftDelete = true,
  // Tablas intermedias (join) no tienen softdelete propio: la vigencia se
  // valida contra la solicitud relacionada (QAS-SI-014).
  viaSolicitud = false,
): Promise<number> {
  const delegate = (prisma as unknown as Record<string, {
    count(args: { where: Record<string, unknown> }): Promise<number>
  }>)[delegateName]

  return delegate.count({
    where: {
      [parentField]: parentId,
      ...(viaSolicitud
        ? { solicitud: { eliminadoEn: null } }
        : usesSoftDelete ? { eliminadoEn: null } : {}),
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
