import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { ValidationError } from './errors.js'

// Temporada del documento PADRE (2026-11-16): todo documento hijo copia la
// temporada de su padre al crearse y no se cambia después (no existen hijos de
// otra temporada). Las consultas corren bajo la extensión de tenancy, así que
// solo encuentran padres de la empresa activa.

type Db = Prisma.TransactionClient | typeof prisma

function exigir(fila: { temporadaId: number } | null, documento: string): number {
  if (!fila) throw new ValidationError(`${documento} no existe`)
  return fila.temporadaId
}

export async function temporadaDeNotaVenta(id: number, db: Db = prisma): Promise<number> {
  return exigir(await db.notaVenta.findFirst({ where: { id }, select: { temporadaId: true } }), 'El Cierre Comercial')
}

export async function temporadaDeEmbarque(id: number, db: Db = prisma): Promise<number> {
  return exigir(await db.embarque.findFirst({ where: { id }, select: { temporadaId: true } }), 'El Embarque')
}

export async function temporadaDeReclamo(id: number, db: Db = prisma): Promise<number> {
  return exigir(await db.reclamo.findFirst({ where: { id }, select: { temporadaId: true } }), 'El Reclamo')
}

export async function temporadaDeFacturaExportacion(id: number, db: Db = prisma): Promise<number> {
  return exigir(await db.facturaExportacion.findFirst({ where: { id }, select: { temporadaId: true } }), 'La Factura de Exportación')
}

export async function temporadaDeFacturaNacional(id: number, db: Db = prisma): Promise<number> {
  return exigir(await db.facturaNacional.findFirst({ where: { id }, select: { temporadaId: true } }), 'La Factura Nacional')
}

export async function temporadaDePago(id: number, db: Db = prisma): Promise<number> {
  return exigir(await db.pago.findFirst({ where: { id }, select: { temporadaId: true } }), 'El Pago')
}

export async function temporadaDeMovimiento(id: number, db: Db = prisma): Promise<number> {
  return exigir(await db.movimiento.findFirst({ where: { id }, select: { temporadaId: true } }), 'El Movimiento')
}

export async function temporadaDeOrdenCompraMaterial(id: number, db: Db = prisma): Promise<number> {
  return exigir(await db.ordenCompraMaterial.findFirst({ where: { id }, select: { temporadaId: true } }), 'La Orden de Compra de Materiales')
}

export async function temporadaDeProformaMaterial(id: number, db: Db = prisma): Promise<number> {
  return exigir(await db.proformaMaterial.findFirst({ where: { id }, select: { temporadaId: true } }), 'La Proforma de Materiales')
}

export async function temporadaDeProformaProductor(id: number, db: Db = prisma): Promise<number> {
  return exigir(await db.proformaProductor.findFirst({ where: { id }, select: { temporadaId: true } }), 'La Proforma de Productor')
}

export async function temporadaDeOrdenCompra(id: number, db: Db = prisma): Promise<number> {
  return exigir(await db.ordenCompra.findFirst({ where: { id }, select: { temporadaId: true } }), 'La Orden de Compra')
}
