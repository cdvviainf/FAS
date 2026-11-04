import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { ValidationError } from '../../../shared/errors.js'
import {
  LOCK_NAMESPACE_DOCUMENTO_MANUAL_NUMERO,
  LOCK_NAMESPACE_DOCUMENTO_MANUAL_PROCESO,
} from '../../../shared/advisory-locks.js'
import type {
  ClaseDocumentoManual,
  DocumentoManualCreateInput,
  DocumentoManualLineaInput,
  DocumentoManualReferenciaInput,
  DocumentoManualTransporteInput,
  DocumentoManualUpdateInput,
  DocumentoManualListFilters,
} from './generador-dte.types.js'

const round2 = (n: number) => Math.round(n * 100) / 100
const IVA_TASA = 0.19

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any

const entidadSelect = { id: true, codigo: true, descripcion: true, razonSocial: true, identificador: true }
const mantenedorSelect = { id: true, codigo: true, descripcion: true }

const includeDetalle = {
  entidad: { select: entidadSelect },
  guiaTransporte: { select: entidadSelect },
  moneda: { select: { id: true, codigo: true, descripcion: true } },
  condicionPago: { select: { id: true, codigo: true, descripcion: true } },
  lineas: {
    orderBy: { orden: 'asc' as const },
    include: { articulo: { select: mantenedorSelect } },
  },
  referencias: { orderBy: { orden: 'asc' as const } },
} satisfies Prisma.DocumentoManualInclude

// ─── Cálculo de montos + tipoDte ───────────────────────────────────────────────
// FACTURA_NACIONAL deriva 33 (hay alguna afecta) / 34 (todas exentas). Las demás
// clases tienen tipoDte fijo. El neto/exento/IVA/total se calcula igual para todas
// (informativo; los totales reales los recalcula LibreDTE al timbrar — fase 2).
const TIPO_DTE_FIJO: Record<Exclude<ClaseDocumentoManual, 'FACTURA_NACIONAL'>, number> = {
  GUIA_DESPACHO: 52,
  NOTA_CREDITO: 61,
  NOTA_DEBITO: 56,
}

export function calcularMontosYTipoDte(clase: ClaseDocumentoManual, lineas: DocumentoManualLineaInput[]) {
  let neto = 0
  let exento = 0
  for (const l of lineas) {
    const monto = round2(l.cantidad * l.precioUnitario)
    if (l.exento) exento += monto
    else neto += monto
  }
  neto = round2(neto)
  exento = round2(exento)
  const iva = Math.round(neto * IVA_TASA)
  const total = round2(neto + iva + exento)
  const tipoDte =
    clase === 'FACTURA_NACIONAL'
      ? lineas.every((l) => l.exento)
        ? 34
        : 33
      : TIPO_DTE_FIJO[clase]
  return { montoNeto: neto, montoExento: exento, montoIva: iva, montoTotal: total, tipoDte }
}

function lineasPersistir(lineas: DocumentoManualLineaInput[]) {
  return lineas.map((l, i) => ({
    descripcion: l.descripcion.trim(),
    articuloId: l.articuloId ?? null,
    cantidad: l.cantidad,
    precioUnitario: l.precioUnitario,
    exento: l.exento,
    montoLinea: round2(l.cantidad * l.precioUnitario),
    orden: i,
  }))
}

function referenciasPersistir(referencias: DocumentoManualReferenciaInput[] | undefined) {
  return (referencias ?? []).map((r, i) => ({
    tipoDocRef: r.tipoDocRef.trim(),
    folioRef: r.folioRef.trim(),
    fechaRef: new Date(r.fechaRef),
    codRef: r.codRef ?? null,
    razonRef: r.razonRef ?? null,
    refOrigenTipo: r.refOrigenTipo ?? null,
    refOrigenId: r.refOrigenId ?? null,
    orden: i,
  }))
}

// Campos de transporte aplanados (solo GUIA_DESPACHO). En otras clases queda null.
function transporteCampos(clase: ClaseDocumentoManual, t: DocumentoManualTransporteInput | null | undefined) {
  if (clase !== 'GUIA_DESPACHO' || !t) {
    return {
      guiaIndTraslado: null,
      guiaTransporteId: null,
      guiaChoferRut: null,
      guiaChoferChileno: true,
      guiaChoferNombre: null,
      guiaPatenteCamion: null,
      guiaPatenteRemolque: null,
      guiaDirOrigen: null,
      guiaComunaOrigen: null,
      guiaDirDestino: null,
      guiaComunaDestino: null,
    }
  }
  return {
    guiaIndTraslado: t.indTraslado,
    guiaTransporteId: t.transporteId ?? null,
    guiaChoferRut: t.choferRut ?? null,
    guiaChoferChileno: t.choferChileno,
    guiaChoferNombre: t.choferNombre ?? null,
    guiaPatenteCamion: t.patenteCamion ?? null,
    guiaPatenteRemolque: t.patenteRemolque ?? null,
    guiaDirOrigen: t.dirOrigen ?? null,
    guiaComunaOrigen: t.comunaOrigen ?? null,
    guiaDirDestino: t.dirDestino ?? null,
    guiaComunaDestino: t.comunaDestino ?? null,
  }
}

// ─── Listado / detalle ──────────────────────────────────────────────────────────

export async function listDocumentosManuales(f: DocumentoManualListFilters) {
  const where: Prisma.DocumentoManualWhereInput = {
    eliminadoEn: null,
    ...(f.claseDocumento ? { claseDocumento: f.claseDocumento } : {}),
    ...(f.estado ? { estado: f.estado } : {}),
    ...(f.entidadId ? { entidadId: f.entidadId } : {}),
    ...(f.q
      ? {
          OR: [
            { codigo: { contains: f.q, mode: 'insensitive' } },
            { entidad: { razonSocial: { contains: f.q, mode: 'insensitive' } } },
            { entidad: { descripcion: { contains: f.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }
  const [data, total] = await Promise.all([
    prisma.documentoManual.findMany({
      where,
      include: {
        entidad: { select: entidadSelect },
        moneda: { select: { id: true, codigo: true, descripcion: true } },
      },
      orderBy: { id: 'desc' },
      skip: (f.page - 1) * f.limit,
      take: f.limit,
    }),
    prisma.documentoManual.count({ where }),
  ])
  return { data, total }
}

export async function getDocumentoManualById(id: number) {
  return prisma.documentoManual.findFirst({ where: { id, eliminadoEn: null }, include: includeDetalle })
}

// ─── Correlativo ──────────────────────────────────────────────────────────────
async function generarCodigo(tx: Tx, empresaId: number): Promise<string> {
  const anio = new Date().getFullYear()
  const prefijo = `GDT-${anio}-`
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_DOCUMENTO_MANUAL_NUMERO}::int, ${empresaId * 100000 + anio}::int)`
  const total = await tx.documentoManual.count({ where: { codigo: { startsWith: prefijo } } })
  return `${prefijo}${String(total + 1).padStart(4, '0')}`
}

// ─── Crear ──────────────────────────────────────────────────────────────────────
export async function createDocumentoManual(data: DocumentoManualCreateInput, creadoPorId: string) {
  return prisma.$transaction(async (tx) => {
    const empresaId = getEmpresaIdActual()!
    const codigo = await generarCodigo(tx, empresaId)
    const montos = calcularMontosYTipoDte(data.claseDocumento, data.lineas)

    return tx.documentoManual.create({
      data: {
        empresaId,
        codigo,
        claseDocumento: data.claseDocumento,
        tipoDte: montos.tipoDte,
        entidadId: data.entidadId,
        monedaId: data.monedaId,
        tipoCambio: data.tipoCambio ?? null,
        condicionPagoId: data.claseDocumento === 'FACTURA_NACIONAL' ? (data.condicionPagoId ?? null) : null,
        montoNeto: montos.montoNeto,
        montoExento: montos.montoExento,
        montoIva: montos.montoIva,
        montoTotal: montos.montoTotal,
        idioma: data.idioma ?? 'ES',
        estado: 'BORRADOR',
        fechaDocumento: new Date(data.fechaDocumento),
        observaciones: data.observaciones ?? null,
        ...transporteCampos(data.claseDocumento, data.transporte),
        creadoPorId,
        lineas: { create: lineasPersistir(data.lineas) },
        referencias:
          data.claseDocumento === 'NOTA_CREDITO' || data.claseDocumento === 'NOTA_DEBITO'
            ? { create: referenciasPersistir(data.referencias) }
            : undefined,
      },
      include: includeDetalle,
    })
  })
}

// ─── Editar (solo BORRADOR) ──────────────────────────────────────────────────────
async function lockYVerificarEditable(tx: Tx, id: number): Promise<ClaseDocumentoManual> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_DOCUMENTO_MANUAL_PROCESO}::int, ${id}::int)`
  const actual = await tx.documentoManual.findFirst({ where: { id, eliminadoEn: null }, select: { estado: true, claseDocumento: true } })
  if (!actual) throw new ValidationError('El documento ya no existe')
  if (actual.estado !== 'BORRADOR') {
    throw new ValidationError('Solo se puede editar un documento en estado Borrador')
  }
  return actual.claseDocumento as ClaseDocumentoManual
}

export async function updateDocumentoManual(id: number, data: DocumentoManualUpdateInput) {
  return prisma.$transaction(async (tx) => {
    const clase = await lockYVerificarEditable(tx, id)

    // Recalcular montos/tipoDte si cambian las líneas (replace-all).
    if (data.lineas !== undefined) {
      const montos = calcularMontosYTipoDte(clase, data.lineas)
      await tx.documentoManualLinea.deleteMany({ where: { documentoManualId: id } })
      await tx.documentoManualLinea.createMany({
        data: lineasPersistir(data.lineas).map((l) => ({ documentoManualId: id, ...l })),
      })
      await tx.documentoManual.update({
        where: { id },
        data: {
          tipoDte: montos.tipoDte,
          montoNeto: montos.montoNeto,
          montoExento: montos.montoExento,
          montoIva: montos.montoIva,
          montoTotal: montos.montoTotal,
        },
      })
    }

    // Referencias (replace-all) — solo NC/ND.
    if (data.referencias !== undefined && (clase === 'NOTA_CREDITO' || clase === 'NOTA_DEBITO')) {
      await tx.documentoManualReferencia.deleteMany({ where: { documentoManualId: id } })
      await tx.documentoManualReferencia.createMany({
        data: referenciasPersistir(data.referencias).map((r) => ({ documentoManualId: id, ...r })),
      })
    }

    return tx.documentoManual.update({
      where: { id },
      data: {
        ...(data.entidadId !== undefined ? { entidadId: data.entidadId } : {}),
        ...(data.monedaId !== undefined ? { monedaId: data.monedaId } : {}),
        ...(data.tipoCambio !== undefined ? { tipoCambio: data.tipoCambio } : {}),
        ...(data.fechaDocumento !== undefined ? { fechaDocumento: new Date(data.fechaDocumento) } : {}),
        ...(clase === 'FACTURA_NACIONAL' && data.condicionPagoId !== undefined ? { condicionPagoId: data.condicionPagoId } : {}),
        ...(data.idioma !== undefined ? { idioma: data.idioma } : {}),
        ...(data.observaciones !== undefined ? { observaciones: data.observaciones } : {}),
        ...(clase === 'GUIA_DESPACHO' && data.transporte !== undefined ? transporteCampos(clase, data.transporte) : {}),
      },
      include: includeDetalle,
    })
  })
}

// ─── Anular (soft delete, solo BORRADOR) ─────────────────────────────────────────
export async function anularDocumentoManual(id: number, eliminadoPor: string) {
  return prisma.$transaction(async (tx) => {
    await lockYVerificarEditable(tx, id)
    return tx.documentoManual.update({
      where: { id },
      data: { estado: 'ANULADA', eliminadoEn: new Date(), eliminadoPor },
      include: includeDetalle,
    })
  })
}

// ─── Validación de referencias (lecturas simples) ────────────────────────────────
export async function getEntidad(id: number) {
  return prisma.entidad.findFirst({ where: { id, eliminadoEn: null, activo: true }, select: { id: true, tipos: true, identificador: true } })
}

export async function getMoneda(id: number) {
  return prisma.moneda.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true, codigo: true } })
}

export async function getCondicionPago(id: number) {
  return prisma.condicionPago.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true, tipo: true } })
}

export async function getArticulo(id: number) {
  // Articulo no tiene soft-delete (solo `activo`). La extensión de tenancy acota
  // por empresa, así que un artículo de otra empresa no aparece.
  return prisma.articulo.findFirst({ where: { id }, select: { id: true, activo: true } })
}
