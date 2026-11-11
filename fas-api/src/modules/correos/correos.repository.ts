import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { getEmpresaIdActual } from '../../lib/empresa-context.js'

// Registro de correos enviados (2026-11-11): una fila por destinatario.

export async function crearRegistros(data: {
  lote: string
  destinatarios: string[]
  asunto: string
  html: string
  origen: string | null
  pdfTipo: string | null
  pdfId: number | null
}) {
  const empresaId = getEmpresaIdActual()!
  const ids: number[] = []
  // Uno a uno para obtener los ids (createMany no los devuelve en Prisma 5).
  for (const destinatario of data.destinatarios) {
    const r = await prisma.correoEnviado.create({
      data: {
        empresaId,
        lote: data.lote,
        destinatario,
        asunto: data.asunto,
        html: data.html,
        origen: data.origen,
        pdfTipo: data.pdfTipo,
        pdfId: data.pdfId,
      },
      select: { id: true },
    })
    ids.push(r.id)
  }
  return ids
}

// `intentos` es ACUMULADO en toda la vida del registro (incluye reintentos).
export async function marcarEnviado(id: number) {
  await prisma.correoEnviado.updateMany({
    where: { id },
    data: { estado: 'ENVIADO', enviadoEn: new Date(), intentos: { increment: 1 }, ultimoError: null },
  })
}

export async function marcarError(id: number, error: string, final: boolean) {
  await prisma.correoEnviado.updateMany({
    where: { id },
    data: { intentos: { increment: 1 }, ultimoError: error.slice(0, 2000), ...(final ? { estado: 'FALLIDO' as const } : {}) },
  })
}

// CE-QA-001: no se pudo encolar el envío (p. ej. Redis caído) → FALLIDO con el
// error, para que quede visible y se pueda reintentar desde el visor.
export async function marcarNoEncolado(id: number, error: string) {
  await prisma.correoEnviado.updateMany({
    where: { id },
    data: { estado: 'FALLIDO', ultimoError: `No se pudo encolar el envío: ${error}`.slice(0, 2000) },
  })
}

export async function getById(id: number) {
  return prisma.correoEnviado.findFirst({ where: { id } })
}

export async function marcarReintento(id: number, userId: string) {
  const r = await prisma.correoEnviado.updateMany({
    where: { id, estado: { not: 'PENDIENTE' } },
    data: { estado: 'PENDIENTE', reintentadoEn: new Date(), reintentadoPor: userId },
  })
  return r.count === 1
}

export interface FiltrosCorreos {
  page: number
  limit: number
  estado?: 'PENDIENTE' | 'ENVIADO' | 'FALLIDO'
  q?: string
  desde?: Date
  hasta?: Date
}

export async function list(f: FiltrosCorreos) {
  const where: Prisma.CorreoEnviadoWhereInput = {
    ...(f.estado ? { estado: f.estado } : {}),
    ...(f.desde || f.hasta ? { creadoEn: { ...(f.desde ? { gte: f.desde } : {}), ...(f.hasta ? { lt: f.hasta } : {}) } } : {}),
    ...(f.q
      ? {
          OR: [
            { destinatario: { contains: f.q, mode: 'insensitive' } },
            { asunto: { contains: f.q, mode: 'insensitive' } },
            { origen: { contains: f.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }
  const [data, total] = await Promise.all([
    prisma.correoEnviado.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (f.page - 1) * f.limit,
      take: f.limit,
      // Sin el HTML en el listado (pesado); se pide en el detalle.
      select: {
        id: true,
        lote: true,
        destinatario: true,
        asunto: true,
        origen: true,
        pdfTipo: true,
        estado: true,
        intentos: true,
        ultimoError: true,
        enviadoEn: true,
        reintentadoEn: true,
        reintentadoPor: true,
        creadoEn: true,
      },
    }),
    prisma.correoEnviado.count({ where }),
  ])
  return { data, total }
}
