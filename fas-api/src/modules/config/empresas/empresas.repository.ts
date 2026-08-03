import { prisma } from '../../../lib/prisma.js'
import type {
  EmpresaCreateInput,
  EmpresaUpdateInput,
  DireccionCreateInput,
  DireccionUpdateInput,
  ContactoCreateInput,
  ContactoUpdateInput,
} from './empresas.schema.js'

// ─── Selectores reutilizables ─────────────────────────────────────────────────

const paisSelect = {
  id: true,
  codigo: true,
  descripcion: true,
} as const

const comunaSelect = {
  id: true,
  codigo: true,
  descripcion: true,
} as const

// ─── Empresas ─────────────────────────────────────────────────────────────────

export async function findAllEmpresas(
  page: number,
  limit: number,
  q?: string,
  activo?: boolean,
) {
  const where = {
    eliminadoEn: null as null,
    ...(q
      ? {
          OR: [
            { codigo: { contains: q, mode: 'insensitive' as const } },
            { razonSocial: { contains: q, mode: 'insensitive' as const } },
            { nombreFantasia: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(activo !== undefined ? { activo } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.empresa.findMany({
      where,
      select: {
        id: true,
        codigo: true,
        razonSocial: true,
        nombreFantasia: true,
        rut: true,
        activo: true,
        creadoEn: true,
      },
      orderBy: { codigo: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.empresa.count({ where }),
  ])

  return { data, total }
}

export async function findEmpresaById(id: number) {
  return prisma.empresa.findFirst({
    where: { id, eliminadoEn: null },
    include: {
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
          paisId: true,
          comunaId: true,
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

export async function findEmpresaByCodigo(codigo: string, excludeId?: number) {
  return prisma.empresa.findFirst({
    where: {
      codigo,
      eliminadoEn: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export async function updateEmpresa(
  id: number,
  data: EmpresaUpdateInput,
  actualizadoPor: string,
) {
  return prisma.empresa.update({
    where: { id },
    data: {
      ...(data.codigo !== undefined ? { codigo: data.codigo } : {}),
      ...(data.razonSocial !== undefined ? { razonSocial: data.razonSocial } : {}),
      ...(data.nombreFantasia !== undefined ? { nombreFantasia: data.nombreFantasia } : {}),
      ...(data.rut !== undefined ? { rut: data.rut } : {}),
      ...(data.giro !== undefined ? { giro: data.giro } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.telefono !== undefined ? { telefono: data.telefono } : {}),
      ...(data.activo !== undefined ? { activo: data.activo } : {}),
      actualizadoPor,
    },
    include: {
      direcciones: { where: { eliminadoEn: null } },
      contactos: { where: { eliminadoEn: null } },
    },
  })
}

export async function createEmpresaCompleta(data: EmpresaCreateInput, creadoPor: string) {
  return prisma.empresa.create({
    data: {
      codigo: data.codigo,
      razonSocial: data.razonSocial,
      nombreFantasia: data.nombreFantasia,
      rut: data.rut,
      giro: data.giro,
      email: data.email,
      telefono: data.telefono,
      activo: data.activo,
      creadoPor,
      direcciones: {
        create: data.direcciones.map((dir) => ({
          codigo: dir.codigo,
          descripcion: dir.descripcion,
          paisId: dir.paisId,
          comunaId: dir.comunaId,
          direccion: dir.direccion,
          esPorDefecto: dir.esPorDefecto,
          latitud: dir.latitud,
          longitud: dir.longitud,
          creadoPor,
        })),
      },
      contactos: {
        create: data.contactos.map((con) => ({
          codigo: con.codigo,
          nombre: con.nombre,
          rut: con.rut,
          whatsapp: con.whatsapp,
          email: con.email,
          telefono: con.telefono,
          tipo: con.tipo,
          esRepresentanteLegal: con.esRepresentanteLegal,
          creadoPor,
        })),
      },
    },
    include: {
      direcciones: {
        where: { eliminadoEn: null },
        include: { pais: { select: paisSelect }, comuna: { select: comunaSelect } },
      },
      contactos: { where: { eliminadoEn: null } },
    },
  })
}

export async function softDeleteEmpresa(id: number, eliminadoPor: string) {
  return prisma.empresa.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor },
  })
}

// ─── Pais/Comuna helpers ──────────────────────────────────────────────────────

export async function findPaisById(id: number) {
  return prisma.pais.findFirst({
    where: { id, eliminadoEn: null },
    select: { id: true, esPaisNacional: true, descripcion: true },
  })
}

export async function findComunaById(id: number) {
  return prisma.comuna.findFirst({
    where: { id, eliminadoEn: null },
    select: { id: true, descripcion: true },
  })
}

// ─── Direcciones ──────────────────────────────────────────────────────────────

export async function findDireccionById(id: number, empresaId: number) {
  return prisma.empresaDireccion.findFirst({
    where: { id, empresaId, eliminadoEn: null },
    include: {
      pais: { select: paisSelect },
      comuna: { select: comunaSelect },
    },
  })
}

export async function findDireccionByCodigo(
  codigo: string,
  empresaId: number,
  excludeId?: number,
) {
  return prisma.empresaDireccion.findFirst({
    where: {
      codigo,
      empresaId,
      eliminadoEn: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export async function clearDireccionPorDefecto(empresaId: number, exceptDirId?: number) {
  await prisma.empresaDireccion.updateMany({
    where: {
      empresaId,
      esPorDefecto: true,
      eliminadoEn: null,
      ...(exceptDirId ? { id: { not: exceptDirId } } : {}),
    },
    data: { esPorDefecto: false },
  })
}

export async function createDireccion(
  empresaId: number,
  data: DireccionCreateInput,
  creadoPor: string,
) {
  return prisma.empresaDireccion.create({
    data: {
      empresaId,
      codigo: data.codigo,
      descripcion: data.descripcion,
      paisId: data.paisId,
      comunaId: data.comunaId,
      direccion: data.direccion,
      esPorDefecto: data.esPorDefecto,
      latitud: data.latitud,
      longitud: data.longitud,
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
  return prisma.empresaDireccion.update({
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
      actualizadoPor,
    },
    include: {
      pais: { select: paisSelect },
      comuna: { select: comunaSelect },
    },
  })
}

export async function softDeleteDireccion(id: number, eliminadoPor: string) {
  return prisma.empresaDireccion.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor },
  })
}

// ─── Contactos ────────────────────────────────────────────────────────────────

export async function findContactoById(id: number, empresaId: number) {
  return prisma.empresaContacto.findFirst({
    where: { id, empresaId, eliminadoEn: null },
  })
}

export async function findContactoByCodigo(
  codigo: string,
  empresaId: number,
  excludeId?: number,
) {
  return prisma.empresaContacto.findFirst({
    where: {
      codigo,
      empresaId,
      eliminadoEn: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export async function findRepresentanteLegalActivo(empresaId: number, excludeId?: number) {
  return prisma.empresaContacto.findFirst({
    where: {
      empresaId,
      esRepresentanteLegal: true,
      eliminadoEn: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export async function createContacto(
  empresaId: number,
  data: ContactoCreateInput,
  creadoPor: string,
) {
  return prisma.empresaContacto.create({
    data: {
      empresaId,
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
  return prisma.empresaContacto.update({
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
  return prisma.empresaContacto.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor },
  })
}
