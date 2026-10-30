import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { ValidationError } from '../../../shared/errors.js'
import { LOCK_NAMESPACE_COBRANZA_NOTA_CREDITO } from '../../../shared/advisory-locks.js'
import { derivarEstadoCuota, derivarEstadoCobranza, inicioDeHoy } from './cobranza-estado.js'

const round2 = (n: number) => Math.round(n * 100) / 100

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

// ─── NC parcial por RECLAMO (crédito al cliente, no anulación) ─────────────────
export interface CrearNcReclamoInput {
  reclamoId: number
  tipoDte: number
  clienteId: number
  monedaId: number
  montoTotal: Prisma.Decimal | number
  idioma: string
  codigo: string
  creadoPorId: string
}

// Crea o reusa la NC del reclamo (serializada por reclamo con advisory lock). La
// NC lleva reclamoId + motivo CORRIGE_MONTO y NO facturaExportacionId (para no
// chocar con "una NC por factura" de anulación y permitir varias NC por factura,
// una por reclamo).
export async function crearOReusarNcReclamo(data: CrearNcReclamoInput) {
  const empresaId = getEmpresaIdActual()
  if (empresaId == null) throw new ValidationError('No hay una empresa activa')
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_COBRANZA_NOTA_CREDITO}::int, hashtext(${`RECLAMO:${data.reclamoId}`}))`
    const existente = await tx.notaCredito.findFirst({ where: { reclamoId: data.reclamoId, eliminadoEn: null }, include: ncInclude })
    if (existente) {
      if (existente.estado === 'APROBADA') throw new ValidationError('Este reclamo ya tiene una Nota de Crédito emitida')
      return existente // BORRADOR/RECHAZADA → reintento
    }
    return tx.notaCredito.create({
      data: {
        empresaId,
        codigo: data.codigo,
        reclamoId: data.reclamoId,
        tipoDte: data.tipoDte,
        motivo: 'CORRIGE_MONTO',
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

// Timbrada: NC de reclamo APROBADA + REDUCE la cobranza de la factura por el
// crédito (baja montoCuota y saldoPendiente oldest-first); la factura NO se
// anula. Atómico. `restante` (crédito que excede el saldo) se ignora.
export async function marcarNcReclamoAprobada(
  ncId: number,
  facturaExportacionId: number,
  creditoMonto: number,
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
    const cuotas = await tx.facturaExportacionCuota.findMany({
      where: { facturaExportacionId },
      select: { id: true, montoCuota: true, saldoPendiente: true, fechaVencimiento: true },
      orderBy: { numeroCuota: 'asc' },
    })
    const hoy = inicioDeHoy()
    let restante = round2(creditoMonto)
    const agregado: Array<{ montoCuota: number; saldoPendiente: number; fechaVencimiento: Date | null }> = []
    for (const c of cuotas) {
      let nuevoMonto = Number(c.montoCuota)
      let nuevoSaldo = Number(c.saldoPendiente)
      if (restante > 0 && nuevoSaldo > 0) {
        const aplicar = round2(Math.min(restante, nuevoSaldo))
        nuevoMonto = round2(nuevoMonto - aplicar)
        nuevoSaldo = round2(nuevoSaldo - aplicar)
        restante = round2(restante - aplicar)
        await tx.facturaExportacionCuota.update({
          where: { id: c.id },
          data: { montoCuota: nuevoMonto, saldoPendiente: nuevoSaldo, estado: derivarEstadoCuota(nuevoMonto, nuevoSaldo, c.fechaVencimiento, hoy) },
        })
      }
      agregado.push({ montoCuota: nuevoMonto, saldoPendiente: nuevoSaldo, fechaVencimiento: c.fechaVencimiento })
    }
    await tx.facturaExportacion.update({
      where: { id: facturaExportacionId },
      data: { estadoCobranza: derivarEstadoCobranza(agregado, hoy) },
    })
    return nc
  })
}
