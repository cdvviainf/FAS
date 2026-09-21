import { prisma } from '../../../lib/prisma.js'
import type { Prisma } from '@prisma/client'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { LOCK_NAMESPACE_DOCUMENTO_DTE_EMISION } from '../../../shared/advisory-locks.js'
import type { ContraparteDte } from './dte-emitidos.types.js'

// Lookups propios de Facturación (no reusar documentos.repository.ts, que no
// selecciona comuna y pertenece al Motor de Documentos interno, un dominio
// distinto). El payload de LibreDTE necesita CmnaRecep como texto (nombre de
// la comuna), no un id.
export async function getEmpresaParaDte(id: number): Promise<ContraparteDte | null> {
  const empresa = await prisma.empresa.findFirst({
    where: { id, eliminadoEn: null },
    select: {
      rut: true,
      giro: true,
      razonSocial: true,
      direcciones: {
        where: { eliminadoEn: null },
        select: { direccion: true, comuna: { select: { descripcion: true } } },
        orderBy: [{ esPorDefecto: 'desc' }, { codigo: 'asc' }],
        take: 1,
      },
    },
  })
  if (!empresa) return null
  const dir = empresa.direcciones[0]
  return {
    rut: empresa.rut,
    giro: empresa.giro,
    razonSocial: empresa.razonSocial,
    direccion: dir?.direccion ?? null,
    comuna: dir?.comuna?.descripcion ?? null,
  }
}

export async function getEntidadParaDte(id: number): Promise<ContraparteDte | null> {
  const entidad = await prisma.entidad.findFirst({
    where: { id, eliminadoEn: null },
    select: {
      identificador: true,
      giro: true,
      razonSocial: true,
      direcciones: {
        where: { eliminadoEn: null },
        select: { direccion: true, comuna: { select: { descripcion: true } } },
        orderBy: [{ esPorDefecto: 'desc' }, { codigo: 'asc' }],
        take: 1,
      },
    },
  })
  if (!entidad) return null
  const dir = entidad.direcciones[0]
  return {
    rut: entidad.identificador,
    giro: entidad.giro,
    razonSocial: entidad.razonSocial,
    direccion: dir?.direccion ?? null,
    comuna: dir?.comuna?.descripcion ?? null,
  }
}

// ─── documentos_dte ─────────────────────────────────────────────────────────

export async function getDocumentoDte(origenTipo: string, origenId: number) {
  return prisma.documentoDte.findFirst({ where: { origenTipo, origenId } })
}

interface DatosNuevoDocumentoDte {
  origenTipo: string
  origenId: number
  tipoDte: number
  rutEmisor: string
  rutReceptor: string
  payloadEnviado: unknown
  creadoPor: string
}

export interface DocumentoDteTomado {
  doc: Prisma.DocumentoDteGetPayload<Record<string, never>>
  // true = este caller "ganó" el turno y debe llamar a LibreDTE; false = ya
  // hay un resultado (TEMPORAL_CREADO) o ya hay otro intento en curso
  // (EMITIENDO) — el caller NO debe volver a llamar a LibreDTE, solo
  // devolver `doc` tal cual (IMP-QA-R1-029, QA ronda 1).
  debeEmitir: boolean
}

// Mismo patrón que crearDocumentoEmitidoIdempotente (documentos.repository.ts,
// DOC-QA-003): advisory lock dentro de una transacción, relectura antes de
// escribir. A diferencia de ese caso, acá la sección crítica también decide
// atómicamente QUIÉN llama a LibreDTE (transición a EMITIENDO), porque la
// llamada externa en sí ocurre fuera de la transacción — no tiene sentido
// mantener una transacción de Postgres abierta (con el advisory lock tomado)
// durante los ~30s de timeout del adapter.
export async function tomarDocumentoDteParaEmitir(data: DatosNuevoDocumentoDte): Promise<DocumentoDteTomado> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_DOCUMENTO_DTE_EMISION}::int, hashtext(${`${data.origenTipo}:${data.origenId}`}))`

    const existente = await tx.documentoDte.findFirst({ where: { origenTipo: data.origenTipo, origenId: data.origenId } })

    if (existente) {
      if (existente.estado === 'TEMPORAL_CREADO' || existente.estado === 'EMITIENDO') {
        return { doc: existente, debeEmitir: false }
      }
      // PENDIENTE (no debería persistir, ver abajo) o ERROR — reintento: este
      // caller toma el turno. Refresca el snapshot completo (payload/RUTs/
      // tipoDte) con lo recién calculado por el caller — sin esto, `payloadEnviado`
      // quedaba con los datos del intento fallido aunque LibreDTE recibiera el
      // payload recalculado (IMP-QA-R2-031, QA ronda 2): la auditoría no
      // correspondía al intento realmente enviado.
      const doc = await tx.documentoDte.update({
        where: { id: existente.id },
        data: {
          estado: 'EMITIENDO',
          tipoDte: data.tipoDte,
          rutEmisor: data.rutEmisor,
          rutReceptor: data.rutReceptor,
          payloadEnviado: data.payloadEnviado as never,
          errorMensaje: null,
          actualizadoPor: data.creadoPor,
        },
      })
      return { doc, debeEmitir: true }
    }

    const doc = await tx.documentoDte.create({
      data: {
        empresaId: getEmpresaIdActual()!,
        origenTipo: data.origenTipo,
        origenId: data.origenId,
        tipoDte: data.tipoDte,
        estado: 'EMITIENDO',
        rutEmisor: data.rutEmisor,
        rutReceptor: data.rutReceptor,
        payloadEnviado: data.payloadEnviado as never, // JSON de Prisma — el shape real lo define LibredteDtePayload
        creadoPor: data.creadoPor,
      },
    })
    return { doc, debeEmitir: true }
  })
}

export async function marcarTemporalCreado(id: number, codigo: string, actualizadoPor: string) {
  return prisma.documentoDte.update({
    where: { id },
    data: { estado: 'TEMPORAL_CREADO', libredteCodigoTemporal: codigo, errorMensaje: null, actualizadoPor },
  })
}

export async function marcarError(id: number, mensaje: string, actualizadoPor: string) {
  return prisma.documentoDte.update({
    where: { id },
    data: { estado: 'ERROR', errorMensaje: mensaje, actualizadoPor },
  })
}
