import { prisma } from '../../../lib/prisma.js'
import type { TipoEntidad } from '@prisma/client'
import type {
  EntidadCreateInput,
  EntidadUpdateInput,
  DireccionCreateInput,
  DireccionUpdateInput,
  ContactoCreateInput,
  ContactoUpdateInput,
} from './entidades.schema.js'

// ─── Selectores reutilizables ─────────────────────────────────────────────────

const paisSelect = {
  id: true,
  codigo: true,
  descripcion: true,
} as const

const paisConOrigenSelect = {
  id: true,
  codigo: true,
  descripcion: true,
  esPaisOrigen: true,
} as const

const comunaSelect = {
  id: true,
  codigo: true,
  descripcion: true,
} as const

// ─── Entidades ────────────────────────────────────────────────────────────────

export async function findAllEntidades(
  page: number,
  limit: number,
  q?: string,
  tipo?: TipoEntidad,
  activo?: boolean,
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
      orderBy: { codigo: 'asc' },
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
          direccion: true,
          esPorDefecto: true,
          creadoEn: true,
          pais: { select: paisSelect },
          comuna: { select: comunaSelect },
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

export async function countEntidadUsos(_id: number): Promise<number> {
  // Los módulos operativos (compras, ventas, etc.) aún no existen.
  // Cuando se implementen, agregar conteos aquí.
  return 0
}

// ─── Pais helpers ─────────────────────────────────────────────────────────────

export async function findPaisById(id: number) {
  return prisma.pais.findFirst({
    where: { id, eliminadoEn: null },
    select: { id: true, esPaisOrigen: true, descripcion: true },
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
      paisId: data.paisId,
      comunaId: data.comunaId,
      direccion: data.direccion,
      esPorDefecto: data.esPorDefecto,
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
      ...(data.paisId !== undefined ? { paisId: data.paisId } : {}),
      ...(data.comunaId !== undefined ? { comunaId: data.comunaId } : {}),
      ...(data.direccion !== undefined ? { direccion: data.direccion } : {}),
      ...(data.esPorDefecto !== undefined ? { esPorDefecto: data.esPorDefecto } : {}),
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
  return prisma.entidadContacto.create({
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
      creadoPor,
    },
  })
}

export async function updateContacto(
  id: number,
  data: ContactoUpdateInput,
  actualizadoPor: string,
) {
  return prisma.entidadContacto.update({
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
      actualizadoPor,
    },
  })
}

export async function softDeleteContacto(id: number, eliminadoPor: string) {
  return prisma.entidadContacto.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor },
  })
}
