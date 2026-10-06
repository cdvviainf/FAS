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
  etiqueta: 'etiqueta',
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
  grupoDefecto: 'grupoDefecto',
  defecto: 'defecto',
  categoria: 'categoria',
  calibre: 'calibre',
  parametro: 'parametro',
  clausulaVenta: 'clausulaVenta',
  tipoReclamo: 'tipoReclamo',
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
  grupoDefecto: { tipoDefecto: { select: { id: true, descripcion: true } } },
  defecto: {
    grupoDefecto: { select: { id: true, descripcion: true } },
    especies: { select: { especieId: true, especie: { select: { id: true, descripcion: true } } } },
  },
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
type FkFilterKey = 'regionId' | 'provinciaId' | 'especieId' | 'grupoVariedadId' | 'tipoParametroId' | 'grupoMercadoId' | 'paisId' | 'tipoEmbarqueId' | 'comunaId' | 'mercadoId' | 'tipoDefectoId' | 'grupoDefectoId'

const fkFilterMap: Partial<Record<MantenedorModelo, FkFilterKey[]>> = {
  provincia: ['regionId'],
  comuna: ['provinciaId'],
  grupoVariedad: ['especieId'],
  variedad: ['especieId', 'grupoVariedadId'],
  categoria: ['especieId'],
  calibre: ['especieId'],
  grupoDefecto: ['tipoDefectoId'],
  defecto: ['grupoDefectoId'],
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

// Orden de listado por modelo: los maestros con `orden` por especie (Categoría,
// Calibre) salen por (especie, orden); los que dependen de especie sin `orden`
// (Grupo de Variedad, Variedad) por (especie, código); el resto por código.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function orderByMantenedor(modelo: MantenedorModelo): any {
  if (modelo === 'categoria' || modelo === 'calibre') {
    return [{ especieId: 'asc' }, { orden: 'asc' }]
  }
  if (modelo === 'grupoVariedad' || modelo === 'variedad') {
    return [{ especieId: 'asc' }, { codigo: 'asc' }]
  }
  return { codigo: 'asc' }
}

const MODELOS_CON_ORDEN = new Set<MantenedorModelo>(['categoria', 'calibre'])
const MODELOS_CON_ESPECIE = new Set<MantenedorModelo>(['grupoVariedad', 'variedad', 'categoria', 'calibre'])

// Orden explícito pedido por el usuario (header clicable). `sort` viene como
// JSON [{ id, desc }] (formato TanStack). Si es inválido o no aplica al modelo,
// cae al orden por defecto.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveOrderBy(modelo: MantenedorModelo, sort?: string): any {
  if (sort) {
    try {
      const arr = JSON.parse(sort) as Array<{ id: string; desc: boolean }>
      const first = Array.isArray(arr) ? arr[0] : null
      if (first?.id) {
        const dir = first.desc ? 'desc' : 'asc'
        switch (first.id) {
          case 'codigo': return { codigo: dir }
          case 'descripcion': return { descripcion: dir }
          case 'descripcionExtranjera': return { descripcionExtranjera: dir }
          case 'bloqueado': return { bloqueado: dir }
          // Clic en "Orden": orden numérico puro (columna Int), especie como desempate.
          case 'orden': if (MODELOS_CON_ORDEN.has(modelo)) return [{ orden: dir }, { especieId: 'asc' }]; break
          // Clic en "Especie": especie primero, y dentro por orden (o código).
          case 'especie':
            if (MODELOS_CON_ESPECIE.has(modelo)) {
              return MODELOS_CON_ORDEN.has(modelo)
                ? [{ especie: { descripcion: dir } }, { orden: 'asc' }]
                : [{ especie: { descripcion: dir } }, { codigo: 'asc' }]
            }
            break
        }
      }
    } catch {
      /* sort inválido: orden por defecto */
    }
  }
  return orderByMantenedor(modelo)
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
      orderBy: resolveOrderBy(modelo, filters.sort),
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

// ─── Pais ↔ Mercado (Fase 2b · N:M desde 2026-10-05) ─────────────────────────
// Pais ya no tiene mercadoId propio (ver MercadoPais). Desde 2026-10-05 un país
// puede mapear a VARIOS mercados por empresa — distintos grupos de mercado
// comparten el mismo país. Los reads anidados NO pasan por la extensión de
// tenancy (riesgo residual documentado en Docs/empresas.md §2.c) — el filtro
// por empresa activa se agrega a mano acá, con -1 como centinela cuando no hay
// empresa resuelta (sin coincidencias, en vez de reventar la consulta).
// mercadoIds/mercados (plural) se reconstruyen porque el form de edición del
// frontend (pais-form-sheet.tsx) precarga el multiselect leyendo
// `item.mercadoIds` directamente.
type PaisConMercados = { mercadoIds: number[]; mercados: { id: number; descripcion: string }[] }

function aplanarMercados<T extends { mercadoPaises: { mercadoId: number; mercado: { id: number; descripcion: string } }[] }>(
  pais: T,
): Omit<T, 'mercadoPaises'> & PaisConMercados {
  const { mercadoPaises, ...resto } = pais
  return {
    ...resto,
    mercadoIds: mercadoPaises.map((m) => m.mercadoId),
    mercados: mercadoPaises.map((m) => m.mercado),
  }
}

async function listPaises(filters: MantenedorListFilters) {
  const { q, page = 1, limit = 20, soloActivos, mercadoId, sort } = filters
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

  const includeMercadosActivos = {
    mercadoPaises: {
      where: { empresaId },
      orderBy: { mercadoId: 'asc' as const },
      select: { mercadoId: true, mercado: { select: { id: true, descripcion: true } } },
    },
  }

  const [rows, total] = await Promise.all([
    prisma.pais.findMany({
      where,
      orderBy: resolveOrderBy('pais', sort),
      skip: (page - 1) * limit,
      take: limit,
      include: includeMercadosActivos,
    }),
    prisma.pais.count({ where }),
  ])

  return { data: rows.map(aplanarMercados), total }
}

async function getPaisById(id: number) {
  const empresaId = getEmpresaIdActual() ?? -1
  const row = await prisma.pais.findFirst({
    where: { id, eliminadoEn: null },
    include: {
      mercadoPaises: {
        where: { empresaId },
        orderBy: { mercadoId: 'asc' as const },
        select: { mercadoId: true, mercado: { select: { id: true, descripcion: true } } },
      },
    },
  })
  return row ? aplanarMercados(row) : null
}

/**
 * Sincroniza los mercados de un país para la empresa activa (N:M): borra las
 * aristas país↔mercado que ya no están y crea las nuevas, dejando intactas las
 * que se conservan (para preservar su auditoría). Todo en una transacción.
 */
export async function sincronizarMercadosPais(paisId: number, mercadoIds: number[], userId: string) {
  // empresaId: la extensión de tenancy (prisma-tenancy.ts) lo sobrescribe/valida
  // en cada operación — el valor acá solo satisface el tipo generado por Prisma.
  const empresaId = getEmpresaIdActual()!
  const deseados = [...new Set(mercadoIds)]
  return prisma.$transaction(async (tx) => {
    const actuales = await tx.mercadoPais.findMany({
      where: { empresaId, paisId },
      select: { mercadoId: true },
    })
    const actualesSet = new Set(actuales.map((m) => m.mercadoId))
    const deseadosSet = new Set(deseados)

    const aBorrar = actuales.map((m) => m.mercadoId).filter((m) => !deseadosSet.has(m))
    const aCrear = deseados.filter((m) => !actualesSet.has(m))

    if (aBorrar.length > 0) {
      await tx.mercadoPais.deleteMany({ where: { empresaId, paisId, mercadoId: { in: aBorrar } } })
    }
    if (aCrear.length > 0) {
      await tx.mercadoPais.createMany({
        data: aCrear.map((mercadoId) => ({ empresaId, paisId, mercadoId, creadoPor: userId })),
      })
    }
  })
}

/**
 * Agrega (idempotente, "no duplica") una sola arista país↔mercado para la
 * empresa activa — usado por la carga masiva, que sube una fila por arista y NO
 * debe borrar las otras aristas del país (a diferencia de sincronizarMercadosPais).
 */
export async function agregarMercadoPais(paisId: number, mercadoId: number, userId: string) {
  const empresaId = getEmpresaIdActual()!
  return prisma.mercadoPais.upsert({
    where: { empresaId_mercadoId_paisId: { empresaId, mercadoId, paisId } },
    create: { empresaId, paisId, mercadoId, creadoPor: userId },
    update: { actualizadoPor: userId },
  })
}

/**
 * Sincroniza la validez por especie de un Defecto (N:M, 2026-10-06): borra las
 * asociaciones que ya no están y crea las nuevas. DefectoEspecie es child sin
 * empresaId (FKs por id plano) — el aislamiento lo da el Defecto padre.
 */
export async function sincronizarDefectoEspecies(defectoId: number, especieIds: number[]) {
  const deseados = [...new Set(especieIds)]
  return prisma.$transaction(async (tx) => {
    const actuales = await tx.defectoEspecie.findMany({ where: { defectoId }, select: { especieId: true } })
    const actualesSet = new Set(actuales.map((a) => a.especieId))
    const deseadosSet = new Set(deseados)
    const aBorrar = actuales.map((a) => a.especieId).filter((e) => !deseadosSet.has(e))
    const aCrear = deseados.filter((e) => !actualesSet.has(e))
    if (aBorrar.length > 0) {
      await tx.defectoEspecie.deleteMany({ where: { defectoId, especieId: { in: aBorrar } } })
    }
    if (aCrear.length > 0) {
      await tx.defectoEspecie.createMany({ data: aCrear.map((especieId) => ({ defectoId, especieId })) })
    }
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
    | 'solicitudInspeccionEmbalaje'
    | 'articulo'
    | 'notaVenta'
    | 'ordenCompra',
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
