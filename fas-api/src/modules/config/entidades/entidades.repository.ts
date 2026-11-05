import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import type { TipoEntidad, Prisma, CategoriaContacto } from '@prisma/client'
import type {
  EntidadCreateInput,
  EntidadUpdateInput,
  DireccionCreateInput,
  DireccionUpdateInput,
  ContactoCreateInput,
  ContactoUpdateInput,
} from './entidades.schema.js'

// ─── Selectores reutilizables ─────────────────────────────────────────────────

// Entidad Notify/Consignatario vinculada a un contacto (2026-11-05).
const entidadVinculadaSelect = { id: true, codigo: true, descripcion: true, razonSocial: true, tipos: true }

const paisSelect = {
  id: true,
  codigo: true,
  descripcion: true,
} as const

const paisConOrigenSelect = {
  id: true,
  codigo: true,
  descripcion: true,
  esPaisNacional: true,
} as const

const comunaSelect = {
  id: true,
  codigo: true,
  descripcion: true,
} as const

// ─── Entidades ────────────────────────────────────────────────────────────────

// Orden dinámico del listado (FAS-ENT-SORT): el frontend manda `sort` como JSON
// [{id,desc}] (mismo formato que useDataTable). Mapea los ids de columna del
// listado a campos ordenables. Por defecto, código ascendente.
function resolveOrderByEntidad(sort?: string): Prisma.EntidadOrderByWithRelationInput[] {
  if (sort) {
    try {
      const arr = JSON.parse(sort) as Array<{ id: string; desc: boolean }>
      const first = Array.isArray(arr) ? arr[0] : null
      if (first?.id) {
        const dir = first.desc ? 'desc' : 'asc'
        // Desempate por `codigo` (único) en los campos no únicos, para que la
        // paginación server-side tenga un orden total y reproducible.
        switch (first.id) {
          case 'codigo': return [{ codigo: dir }]
          case 'descripcion': return [{ descripcion: dir }, { codigo: 'asc' }]
          case 'activo': return [{ activo: dir }, { codigo: 'asc' }]
        }
      }
    } catch {
      /* sort inválido: orden por defecto */
    }
  }
  return [{ codigo: 'asc' }]
}

export async function findAllEntidades(
  page: number,
  limit: number,
  q?: string,
  tipo?: TipoEntidad,
  activo?: boolean,
  sort?: string,
) {
  const where = {
    eliminadoEn: null as null,
    ...(q
      ? {
          OR: [
            { codigo: { contains: q, mode: 'insensitive' as const } },
            { descripcion: { contains: q, mode: 'insensitive' as const } },
            { razonSocial: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(tipo ? { tipos: { has: tipo } } : {}),
    ...(activo !== undefined ? { activo } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.entidad.findMany({
      where,
      select: {
        id: true,
        codigo: true,
        descripcion: true,
        razonSocial: true,
        tipos: true,
        activo: true,
        creadoEn: true,
        pais: { select: paisSelect },
      },
      orderBy: resolveOrderByEntidad(sort),
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.entidad.count({ where }),
  ])

  return { data, total }
}

export async function findEntidadById(id: number) {
  return prisma.entidad.findFirst({
    where: { id, eliminadoEn: null },
    include: {
      pais: { select: paisConOrigenSelect },
      direcciones: {
        where: { eliminadoEn: null },
        select: {
          id: true,
          codigo: true,
          descripcion: true,
          direccion: true,
          esPorDefecto: true,
          latitud: true,
          longitud: true,
          creadoEn: true,
          pais: { select: paisSelect },
          comuna: { select: comunaSelect },
          puertoId: true,
          puerto: { select: { id: true, codigo: true, descripcion: true } },
        },
        orderBy: [{ esPorDefecto: 'desc' }, { codigo: 'asc' }],
      },
      contactos: {
        where: { eliminadoEn: null },
        select: {
          id: true,
          codigo: true,
          nombre: true,
          rut: true,
          whatsapp: true,
          email: true,
          telefono: true,
          tipo: true,
          esRepresentanteLegal: true,
          categorias: true,
          categoriasPorDefecto: true,
          entidadVinculadaId: true,
          entidadVinculada: { select: entidadVinculadaSelect },
          creadoEn: true,
        },
        orderBy: [{ esRepresentanteLegal: 'desc' }, { codigo: 'asc' }],
      },
    },
  })
}

export async function findEntidadByCodigo(codigo: string, excludeId?: number) {
  return prisma.entidad.findFirst({
    where: {
      codigo,
      eliminadoEn: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export async function findEntidadByIdentificador(identificador: string, excludeId?: number) {
  return prisma.entidad.findFirst({
    where: {
      identificador,
      eliminadoEn: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export async function createEntidad(
  data: EntidadCreateInput,
  creadoPor: string,
) {
  return prisma.entidad.create({
    data: {
      // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe este
      // valor con la empresa activa del contexto — se declara aquí solo para
      // satisfacer el tipo requerido por Prisma.
      empresaId: getEmpresaIdActual()!,
      codigo: data.codigo,
      descripcion: data.descripcion,
      descripcionExtranjera: data.descripcionExtranjera,
      razonSocial: data.razonSocial,
      giro: data.giro,
      identificador: data.identificador,
      paisId: data.paisId,
      email: data.email,
      telefono: data.telefono,
      codigoExterno: data.codigoExterno,
      csp: data.csp,
      taxId: data.taxId,
      activo: data.activo,
      tipos: data.tipos,
      creadoPor,
    },
    include: {
      pais: { select: paisConOrigenSelect },
      direcciones: { where: { eliminadoEn: null } },
      contactos: { where: { eliminadoEn: null } },
    },
  })
}

export async function updateEntidad(
  id: number,
  data: EntidadUpdateInput,
  actualizadoPor: string,
) {
  return prisma.entidad.update({
    where: { id },
    data: {
      ...(data.codigo !== undefined ? { codigo: data.codigo } : {}),
      ...(data.descripcion !== undefined ? { descripcion: data.descripcion } : {}),
      ...(data.descripcionExtranjera !== undefined ? { descripcionExtranjera: data.descripcionExtranjera } : {}),
      ...(data.razonSocial !== undefined ? { razonSocial: data.razonSocial } : {}),
      ...(data.giro !== undefined ? { giro: data.giro } : {}),
      ...(data.identificador !== undefined ? { identificador: data.identificador } : {}),
      ...(data.paisId !== undefined ? { paisId: data.paisId } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.telefono !== undefined ? { telefono: data.telefono } : {}),
      ...(data.codigoExterno !== undefined ? { codigoExterno: data.codigoExterno } : {}),
      ...(data.csp !== undefined ? { csp: data.csp } : {}),
      ...(data.taxId !== undefined ? { taxId: data.taxId } : {}),
      ...(data.activo !== undefined ? { activo: data.activo } : {}),
      ...(data.tipos !== undefined ? { tipos: data.tipos } : {}),
      actualizadoPor,
    },
    include: {
      pais: { select: paisConOrigenSelect },
      direcciones: { where: { eliminadoEn: null } },
      contactos: { where: { eliminadoEn: null } },
    },
  })
}

export async function softDeleteEntidad(id: number, eliminadoPor: string) {
  return prisma.entidad.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor },
  })
}

export async function countEntidadUsos(id: number): Promise<number> {
  // Los módulos operativos (compras, ventas, etc.) aún no existen.
  // Cuando se implementen, agregar conteos aquí.
  // QAS-SI-001: solicitudes de inspección vigentes que usan esta entidad como productor.
  // QAS-SI-014: también como cliente (extranjero) del Documento 107.
  const [comoProductor, comoCliente] = await Promise.all([
    prisma.solicitudInspeccion.count({ where: { entidadProductorId: id, eliminadoEn: null } }),
    prisma.solicitudInspeccion.count({ where: { clienteId: id, eliminadoEn: null } }),
  ])
  return comoProductor + comoCliente
}

/** Solicitudes de inspección vigentes que usan una dirección de entidad. */
export async function countDireccionUsos(dirId: number): Promise<number> {
  return prisma.solicitudInspeccion.count({
    where: { direccionId: dirId, eliminadoEn: null },
  })
}

/** Solicitudes de inspección vigentes que usan un contacto de entidad. */
export async function countContactoUsos(conId: number): Promise<number> {
  return prisma.solicitudInspeccion.count({
    where: { contactoId: conId, eliminadoEn: null },
  })
}

// ─── Pais helpers ─────────────────────────────────────────────────────────────

export async function findPaisById(id: number) {
  return prisma.pais.findFirst({
    where: { id, eliminadoEn: null },
    select: { id: true, esPaisNacional: true, descripcion: true },
  })
}

export async function findComunaById(id: number) {
  return prisma.comuna.findFirst({
    where: { id, eliminadoEn: null },
    select: {
      id: true,
      descripcion: true,
      provincia: { select: { region: { select: { id: true } } } },
    },
  })
}

// Puerto activo de la empresa actual (la extensión de tenancy inyecta empresaId),
// para validar el puertoId opcional de una dirección.
export async function findPuertoActivo(id: number) {
  return prisma.puerto.findFirst({ where: { id, eliminadoEn: null }, select: { id: true } })
}

// ─── Direcciones ──────────────────────────────────────────────────────────────

export async function findDireccionById(id: number, entidadId: number) {
  return prisma.entidadDireccion.findFirst({
    where: { id, entidadId, eliminadoEn: null },
    include: {
      pais: { select: paisSelect },
      comuna: { select: comunaSelect },
    },
  })
}

export async function findDireccionByCodigo(
  codigo: string,
  entidadId: number,
  excludeId?: number,
) {
  return prisma.entidadDireccion.findFirst({
    where: {
      codigo,
      entidadId,
      eliminadoEn: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export async function clearDireccionPorDefecto(entidadId: number, exceptDirId?: number) {
  await prisma.entidadDireccion.updateMany({
    where: {
      entidadId,
      esPorDefecto: true,
      eliminadoEn: null,
      ...(exceptDirId ? { id: { not: exceptDirId } } : {}),
    },
    data: { esPorDefecto: false },
  })
}

export async function createDireccion(
  entidadId: number,
  data: DireccionCreateInput,
  creadoPor: string,
) {
  return prisma.entidadDireccion.create({
    data: {
      entidadId,
      codigo: data.codigo,
      descripcion: data.descripcion,
      paisId: data.paisId,
      comunaId: data.comunaId,
      direccion: data.direccion,
      esPorDefecto: data.esPorDefecto,
      latitud: data.latitud,
      longitud: data.longitud,
      puertoId: data.puertoId ?? null,
      creadoPor,
    },
    include: {
      pais: { select: paisSelect },
      comuna: { select: comunaSelect },
    },
  })
}

export async function updateDireccion(
  id: number,
  data: DireccionUpdateInput,
  actualizadoPor: string,
) {
  return prisma.entidadDireccion.update({
    where: { id },
    data: {
      ...(data.codigo !== undefined ? { codigo: data.codigo } : {}),
      ...(data.descripcion !== undefined ? { descripcion: data.descripcion } : {}),
      ...(data.paisId !== undefined ? { paisId: data.paisId } : {}),
      ...(data.comunaId !== undefined ? { comunaId: data.comunaId } : {}),
      ...(data.direccion !== undefined ? { direccion: data.direccion } : {}),
      ...(data.esPorDefecto !== undefined ? { esPorDefecto: data.esPorDefecto } : {}),
      ...(data.latitud !== undefined ? { latitud: data.latitud } : {}),
      ...(data.longitud !== undefined ? { longitud: data.longitud } : {}),
      ...(data.puertoId !== undefined ? { puertoId: data.puertoId } : {}),
      actualizadoPor,
    },
    include: {
      pais: { select: paisSelect },
      comuna: { select: comunaSelect },
    },
  })
}

export async function softDeleteDireccion(id: number, eliminadoPor: string) {
  return prisma.entidadDireccion.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor },
  })
}

// ─── Contactos ────────────────────────────────────────────────────────────────

const contactoInclude = { entidadVinculada: { select: entidadVinculadaSelect } }

// Entidad a vincular como Notify/Consignatario de un contacto: activa, no
// eliminada y de la empresa activa (Entidad es tenant: la extensión filtra).
export async function findEntidadVinculable(id: number) {
  return prisma.entidad.findFirst({
    where: { id, eliminadoEn: null, activo: true },
    select: { id: true, tipos: true },
  })
}

// Quita `categoria` de categoriasPorDefecto de los demás contactos de la
// entidad: a lo sumo un contacto por defecto por (entidad, categoría).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function liberarDefaults(tx: any, entidadId: number, categorias: CategoriaContacto[], excludeId: number) {
  for (const categoria of categorias) {
    await tx.$executeRaw`
      UPDATE "entidad_contactos"
      SET "categoriasPorDefecto" = array_remove("categoriasPorDefecto", ${categoria}::"CategoriaContacto")
      WHERE "entidadId" = ${entidadId} AND id <> ${excludeId} AND ${categoria}::"CategoriaContacto" = ANY("categoriasPorDefecto")`
  }
}

export async function findContactoById(id: number, entidadId: number) {
  return prisma.entidadContacto.findFirst({
    where: { id, entidadId, eliminadoEn: null },
  })
}

export async function findContactoByCodigo(
  codigo: string,
  entidadId: number,
  excludeId?: number,
) {
  return prisma.entidadContacto.findFirst({
    where: {
      codigo,
      entidadId,
      eliminadoEn: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export async function findRepresentanteLegalActivo(entidadId: number, excludeId?: number) {
  return prisma.entidadContacto.findFirst({
    where: {
      entidadId,
      esRepresentanteLegal: true,
      eliminadoEn: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export async function createContacto(
  entidadId: number,
  data: ContactoCreateInput,
  creadoPor: string,
) {
  return prisma.$transaction(async (tx) => {
    // CCN26-R2-005: liberar PRIMERO los defaults de los demás contactos y
    // recién después crear — al revés, el índice único parcial rechaza la
    // inserción antes de llegar a liberar (el contacto aún no tiene id: -1
    // no excluye a nadie).
    await liberarDefaults(tx, entidadId, data.categoriasPorDefecto ?? [], -1)
    const creado = await tx.entidadContacto.create({
    data: {
      entidadId,
      codigo: data.codigo,
      nombre: data.nombre,
      rut: data.rut,
      whatsapp: data.whatsapp,
      email: data.email,
      telefono: data.telefono,
      tipo: data.tipo,
      esRepresentanteLegal: data.esRepresentanteLegal,
      categorias: data.categorias,
      categoriasPorDefecto: data.categoriasPorDefecto,
      entidadVinculadaId: data.entidadVinculadaId ?? null,
      creadoPor,
    },
    include: contactoInclude,
    })
    return creado
  })
}

export async function updateContacto(
  id: number,
  data: ContactoUpdateInput,
  actualizadoPor: string,
) {
  return prisma.$transaction(async (tx) => {
    // CCN26-R2-005: liberar antes de escribir (ver createContacto). Solo si el
    // PATCH trae categoriasPorDefecto; si no, los defaults no cambian.
    if (data.categoriasPorDefecto !== undefined && data.categoriasPorDefecto.length > 0) {
      const actual = await tx.entidadContacto.findUniqueOrThrow({ where: { id }, select: { entidadId: true } })
      await liberarDefaults(tx, actual.entidadId, data.categoriasPorDefecto, id)
    }
    const actualizado = await tx.entidadContacto.update({
    where: { id },
    data: {
      ...(data.codigo !== undefined ? { codigo: data.codigo } : {}),
      ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
      ...(data.rut !== undefined ? { rut: data.rut } : {}),
      ...(data.whatsapp !== undefined ? { whatsapp: data.whatsapp } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.telefono !== undefined ? { telefono: data.telefono } : {}),
      ...(data.tipo !== undefined ? { tipo: data.tipo } : {}),
      ...(data.esRepresentanteLegal !== undefined ? { esRepresentanteLegal: data.esRepresentanteLegal } : {}),
      ...(data.categorias !== undefined ? { categorias: data.categorias } : {}),
      ...(data.categoriasPorDefecto !== undefined ? { categoriasPorDefecto: data.categoriasPorDefecto } : {}),
      ...(data.entidadVinculadaId !== undefined ? { entidadVinculadaId: data.entidadVinculadaId } : {}),
      actualizadoPor,
    },
    include: contactoInclude,
    })
    return actualizado
  })
}

export async function softDeleteContacto(id: number, eliminadoPor: string) {
  return prisma.entidadContacto.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor },
  })
}
