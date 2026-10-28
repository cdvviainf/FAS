import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { ValidationError } from '../../../shared/errors.js'
import { LOCK_NAMESPACE_COBRANZA_NOTA_CREDITO } from '../../../shared/advisory-locks.js'

// Nota de Crédito de anulación (Ciclo 4). Repositorio compartido export/nacional:
// crea/reusa la NC, la marca APROBADA/RECHAZADA y anula la factura referenciada.

const ncInclude = {
  cliente: { select: { id: true, codigo: true, descripcion: true, razonSocial: true } },
  moneda: { select: { id: true, codigo: true, descripcion: true } },
  facturaExportacion: { select: { id: true, codigo: true, folio: true } },
  facturaNacional: { select: { id: true, codigo: true, folio: true } },
} satisfies Prisma.NotaCreditoInclude

export type TipoFacturaNc = 'EXPORTACION' | 'NACIONAL'

export interface CrearNcInput {
  tipoFactura: TipoFacturaNc
  facturaId: number
  tipoDte: number
  clienteId: number
  monedaId: number
  montoTotal: Prisma.Decimal | number
  idioma: string
  codigo: string
  creadoPorId: string
}

export async function getNcActivaPorFactura(tipoFactura: TipoFacturaNc, facturaId: number) {
  const where =
    tipoFactura === 'EXPORTACION'
      ? { facturaExportacionId: facturaId, eliminadoEn: null }
      : { facturaNacionalId: facturaId, eliminadoEn: null }
  return prisma.notaCredito.findFirst({ where, include: ncInclude })
}

export async function getNcById(id: number) {
  return prisma.notaCredito.findFirst({ where: { id, eliminadoEn: null }, include: ncInclude })
}

// Crea la NC de la factura, o reusa la existente si quedó en BORRADOR/RECHAZADA
// (reintento). Si ya hay una APROBADA, la factura ya fue anulada (CB9).
// Serializado por factura con advisory lock (FAS-COB-NC-R1-001): dos
// "anular-con-nc" concurrentes no pueden crear dos NC/folios — el segundo ve la
// NC del primero bajo el lock y la reutiliza (el motor DTE luego reconcilia el
// timbrado idempotentemente por nc.id). El índice único parcial por FK de
// factura es el backstop a nivel BD.
export async function crearOReusarNc(data: CrearNcInput) {
  const empresaId = getEmpresaIdActual()
  if (empresaId == null) throw new ValidationError('No hay una empresa activa')

  return prisma.$transaction(async (tx) => {
    const clave = `${data.tipoFactura}:${data.facturaId}`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_COBRANZA_NOTA_CREDITO}::int, hashtext(${clave}))`

    const whereFactura =
      data.tipoFactura === 'EXPORTACION'
        ? { facturaExportacionId: data.facturaId, eliminadoEn: null }
        : { facturaNacionalId: data.facturaId, eliminadoEn: null }
    const existente = await tx.notaCredito.findFirst({ where: whereFactura, include: ncInclude })
    if (existente) {
      if (existente.estado === 'APROBADA') {
        throw new ValidationError('La factura ya fue anulada con una Nota de Crédito')
      }
      return existente // BORRADOR/RECHAZADA → se reutiliza para reintentar
    }
    return tx.notaCredito.create({
      data: {
        empresaId,
        codigo: data.codigo,
        facturaExportacionId: data.tipoFactura === 'EXPORTACION' ? data.facturaId : null,
        facturaNacionalId: data.tipoFactura === 'NACIONAL' ? data.facturaId : null,
        tipoDte: data.tipoDte,
        motivo: 'ANULA_DOCUMENTO',
        clienteId: data.clienteId,
        monedaId: data.monedaId,
        montoTotal: data.montoTotal,
        idioma: data.idioma,
        creadoPorId: data.creadoPorId,
      },
      include: ncInclude,
    })
  })
}

// Timbrada: NC APROBADA + factura ANULADA (estado SII y estadoCobranza), atómico.
export async function marcarNcAprobadaYAnularFactura(
  tipoFactura: TipoFacturaNc,
  ncId: number,
  facturaId: number,
  datos: { folio: number; trackIdSii: string | null; fechaEmision: Date },
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const nc = await tx.notaCredito.update({
      where: { id: ncId },
      data: {
        estado: 'APROBADA',
        folio: datos.folio,
        trackIdSii: datos.trackIdSii,
        fechaEmision: datos.fechaEmision,
        emitidoPorId: userId,
        emitidoEn: datos.fechaEmision,
        errorMensajeSii: null,
      },
      include: ncInclude,
    })
    if (tipoFactura === 'EXPORTACION') {
      await tx.facturaExportacion.update({ where: { id: facturaId }, data: { estado: 'ANULADA', estadoCobranza: 'ANULADA' } })
    } else {
      await tx.facturaNacional.update({ where: { id: facturaId }, data: { estado: 'ANULADA', estadoCobranza: 'ANULADA' } })
    }
    return nc
  })
}

export async function marcarNcRechazada(ncId: number, errorMensajeSii: string) {
  return prisma.notaCredito.update({ where: { id: ncId }, data: { estado: 'RECHAZADA', errorMensajeSii }, include: ncInclude })
}
