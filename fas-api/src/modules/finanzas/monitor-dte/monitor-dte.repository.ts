import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import type { MonitorDteListQuery } from './monitor-dte.schema.js'

// Límites del día calendario en hora de Chile (America/Santiago), independientes
// de la zona horaria del servidor (FAS-MDTE-R1-001). El offset (−03/−04 según
// horario de verano) se toma al mediodía de ese día para evitar el borde del
// cambio de hora, que en Chile ocurre a medianoche.
const TZ = 'America/Santiago'
function offsetSantiago(fecha: string): string {
  const mediodia = new Date(`${fecha}T12:00:00Z`)
  const parte = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' })
    .formatToParts(mediodia)
    .find((p) => p.type === 'timeZoneName')?.value
  // "GMT-03:00" → "-03:00"; "GMT" (offset 0) → "Z".
  const off = parte?.replace('GMT', '') ?? ''
  return off === '' ? 'Z' : off
}
function inicioDia(f: string) {
  return new Date(`${f}T00:00:00.000${offsetSantiago(f)}`)
}
function finDia(f: string) {
  return new Date(`${f}T23:59:59.999${offsetSantiago(f)}`)
}

// Ids de DocumentoDte cuyo receptor (RUT o razón social del payload enviado)
// contiene el texto, sin distinguir mayúsculas. SQL crudo porque Prisma no
// admite `mode: insensitive` sobre rutas JSON; el empresaId va explícito (la
// extensión de tenancy no cubre $queryRaw).
async function idsPorReceptor(texto: string): Promise<number[]> {
  const empresaId = getEmpresaIdActual()
  if (empresaId == null) return []
  const patron = `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  const filas = await prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
    SELECT "id" FROM "documentos_dte"
    WHERE "empresaId" = ${empresaId}
      AND "estado" = 'GENERADO'
      AND ("rutReceptor" ILIKE ${patron}
        OR ("payloadEnviado" #>> '{Encabezado,Receptor,RznSocRecep}') ILIKE ${patron})
  `)
  return filas.map((f) => f.id)
}

export async function listarFirmados(f: MonitorDteListQuery) {
  const ids = f.receptor ? await idsPorReceptor(f.receptor) : null
  const where: Prisma.DocumentoDteWhereInput = {
    estado: 'GENERADO',
    folio: { not: null },
    ...(f.tipoDte ? { tipoDte: f.tipoDte } : {}),
    ...(f.estadoSii ? { estadoSii: f.estadoSii } : {}),
    ...(f.folio ? { folio: f.folio } : {}),
    ...(f.fechaDesde || f.fechaHasta
      ? {
          generadoEn: {
            ...(f.fechaDesde ? { gte: inicioDia(f.fechaDesde) } : {}),
            ...(f.fechaHasta ? { lte: finDia(f.fechaHasta) } : {}),
          },
        }
      : {}),
    ...(ids ? { id: { in: ids } } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.documentoDte.findMany({
      where,
      select: {
        id: true,
        origenTipo: true,
        origenId: true,
        tipoDte: true,
        folio: true,
        rutEmisor: true,
        rutReceptor: true,
        payloadEnviado: true,
        respuestaGenerar: true,
        generadoEn: true,
        estadoSii: true,
        estadoSiiGlosa: true,
        estadoSiiConsultadoEn: true,
      },
      orderBy: [{ generadoEn: 'desc' }, { id: 'desc' }],
      skip: (f.page - 1) * f.limit,
      take: f.limit,
    }),
    prisma.documentoDte.count({ where }),
  ])
  return { data, total }
}

// Documentos de origen (código/monto/enlace), cargados en lote por tipo.
export async function getOrigenes(porTipo: Map<string, number[]>) {
  const ids = (t: string) => porTipo.get(t) ?? []
  const ncIds = [...ids('nota-credito-exportacion'), ...ids('nota-credito-nacional')]
  const [fexp, fnac, ncs, embarques, movimientos] = await Promise.all([
    ids('factura-exportacion').length
      ? prisma.facturaExportacion.findMany({ where: { id: { in: ids('factura-exportacion') } }, select: { id: true, codigo: true, montoTotal: true, moneda: { select: { codigo: true } } } })
      : [],
    ids('factura-nacional').length
      ? prisma.facturaNacional.findMany({ where: { id: { in: ids('factura-nacional') } }, select: { id: true, codigo: true, montoTotal: true, moneda: { select: { codigo: true } } } })
      : [],
    ncIds.length
      ? prisma.notaCredito.findMany({ where: { id: { in: ncIds } }, select: { id: true, codigo: true, montoTotal: true, facturaExportacionId: true, facturaNacionalId: true, moneda: { select: { codigo: true } } } })
      : [],
    ids('embarque').length ? prisma.embarque.findMany({ where: { id: { in: ids('embarque') } }, select: { id: true, numeroInstructivo: true } }) : [],
    ids('movimiento').length
      ? prisma.movimiento.findMany({ where: { id: { in: ids('movimiento') } }, select: { id: true, tipoMovimiento: { select: { descripcion: true } } } })
      : [],
  ])
  return { fexp, fnac, ncs, embarques, movimientos }
}

export async function getFirmadoById(id: number) {
  return prisma.documentoDte.findFirst({
    where: { id, estado: 'GENERADO' },
    select: { id: true, origenTipo: true, origenId: true, tipoDte: true, folio: true, rutEmisor: true, xml: true, estadoSii: true },
  })
}
