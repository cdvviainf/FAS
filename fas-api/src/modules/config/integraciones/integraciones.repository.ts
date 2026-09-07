import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { encrypt, decrypt } from '../../../lib/crypto.js'
import type {
  IntegracionCreateInput,
  IntegracionUpdateInput,
  IntegracionParametroInput,
  MaestroIntegracion,
} from './integraciones.types.js'

const MASCARA = '••••••••'

// Nunca se expone el valor real de un parámetro sensible por API — ni
// siquiera cifrado (no tiene sentido exponer el ciphertext tampoco).
function serializeParametro<T extends { valorExterno: string; sensible: boolean }>(p: T): T {
  return p.sensible ? { ...p, valorExterno: MASCARA } : p
}

export async function listIntegraciones(page: number, limit: number) {
  const where = { eliminadoEn: null }
  const [data, total] = await Promise.all([
    prisma.integracion.findMany({ where, orderBy: { id: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.integracion.count({ where }),
  ])
  return { data, total }
}

export async function getIntegracionById(id: number) {
  const integracion = await prisma.integracion.findFirst({
    where: { id, eliminadoEn: null },
    include: { parametros: { orderBy: { id: 'asc' } } },
  })
  if (!integracion) return null
  return { ...integracion, parametros: integracion.parametros.map(serializeParametro) }
}

export async function findIntegracionByCodigo(codigo: string) {
  return prisma.integracion.findFirst({ where: { codigo, eliminadoEn: null }, select: { id: true } })
}

export async function createIntegracion(data: IntegracionCreateInput, creadoPor: string) {
  const creada = await prisma.integracion.create({
    // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe este
    // valor con la empresa activa del contexto.
    data: { empresaId: getEmpresaIdActual()!, ...data, creadoPor },
  })
  return getIntegracionById(creada.id)
}

export async function updateIntegracion(id: number, data: IntegracionUpdateInput, actualizadoPor: string) {
  await prisma.integracion.update({ where: { id }, data: { ...data, actualizadoPor } })
  return getIntegracionById(id)
}

export async function softDeleteIntegracion(id: number, eliminadoPor: string) {
  await prisma.integracion.update({ where: { id }, data: { eliminadoEn: new Date(), eliminadoPor } })
}

// ─── Parámetros ──────────────────────────────────────────────────────────────

export async function getParametroCrudoById(id: number) {
  return prisma.integracionParametro.findUnique({ where: { id } })
}

export async function addParametro(integracionId: number, data: IntegracionParametroInput) {
  const esMaestro = data.tipo === 'MAESTRO'
  const p = await prisma.integracionParametro.create({
    data: {
      integracionId,
      idExterno: data.idExterno,
      tipo: data.tipo,
      maestro: esMaestro ? data.maestro : null,
      maestroId: esMaestro ? data.maestroId : null,
      valorLocal: esMaestro ? (data.valorLocal ?? '') : '',
      valorExterno: data.sensible ? encrypt(data.valorExterno!) : data.valorExterno!,
      sensible: data.sensible ?? false,
      descripcion: data.descripcion,
    },
  })
  return serializeParametro(p)
}

// La resolución de "qué valor guardar" (mantener el actual si no viene uno
// nuevo, cifrar/descifrar si `sensible` cambió) vive en el service — acá solo
// se persiste lo ya resuelto.
export async function updateParametroResuelto(
  id: number,
  data: {
    idExterno?: string
    tipo?: 'TEXTO' | 'MAESTRO'
    maestro?: MaestroIntegracion | null
    maestroId?: number | null
    valorLocal?: string
    valorExternoAGuardar: string
    sensible: boolean
    descripcion?: string | null
  },
) {
  const p = await prisma.integracionParametro.update({
    where: { id },
    data: {
      idExterno: data.idExterno,
      tipo: data.tipo,
      maestro: data.tipo === 'MAESTRO' ? data.maestro : data.tipo === 'TEXTO' ? null : undefined,
      maestroId: data.tipo === 'MAESTRO' ? data.maestroId : data.tipo === 'TEXTO' ? null : undefined,
      valorLocal: data.valorLocal,
      valorExterno: data.valorExternoAGuardar,
      sensible: data.sensible,
      descripcion: data.descripcion,
    },
  })
  return serializeParametro(p)
}

export async function removeParametro(id: number) {
  await prisma.integracionParametro.delete({ where: { id } })
}

// ─── Consumo interno (adapters de integración) ──────────────────────────────
// No expuestas por ningún controller — devuelven el valor real (descifrado).

export async function getIntegracionActivaPorCodigo(codigo: string) {
  return prisma.integracion.findFirst({ where: { codigo, activo: true, eliminadoEn: null } })
}

export async function getValorParametro(
  integracionCodigo: string,
  idExterno: string,
  opts: { maestro?: MaestroIntegracion; maestroId?: number } = {},
): Promise<string | null> {
  const parametro = await prisma.integracionParametro.findFirst({
    where: {
      idExterno,
      integracion: { codigo: integracionCodigo, activo: true, eliminadoEn: null },
      ...(opts.maestro ? { maestro: opts.maestro } : {}),
      ...(opts.maestroId !== undefined ? { maestroId: opts.maestroId } : {}),
    },
  })
  if (!parametro) return null
  return parametro.sensible ? decrypt(parametro.valorExterno) : parametro.valorExterno
}

// ─── Opciones de maestro (combobox del formulario) ──────────────────────────

export async function listOpcionesMaestro(maestro: MaestroIntegracion) {
  const mantenedorSelect = { id: true, codigo: true, descripcion: true }
  switch (maestro) {
    case 'ESPECIE':
      return prisma.especie.findMany({ where: { eliminadoEn: null, bloqueado: false }, select: mantenedorSelect, orderBy: { descripcion: 'asc' } })
    case 'ENTIDAD':
      return prisma.entidad.findMany({ where: { eliminadoEn: null, activo: true }, select: mantenedorSelect, orderBy: { descripcion: 'asc' } })
    case 'TIPO_EMBARQUE':
      return prisma.tipoEmbarque.findMany({ where: { eliminadoEn: null, bloqueado: false }, select: mantenedorSelect, orderBy: { descripcion: 'asc' } })
    case 'PUERTO':
      return prisma.puerto.findMany({ where: { eliminadoEn: null, bloqueado: false }, select: mantenedorSelect, orderBy: { descripcion: 'asc' } })
  }
}
