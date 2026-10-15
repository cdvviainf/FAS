import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { ValidationError } from '../../../shared/errors.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { LOCK_NAMESPACE_DOCUMENTO_DTE_EMISION } from '../../../shared/advisory-locks.js'
import type { FacturasNacionalListFilters } from './factura-nacional.types.js'

// origenTipo del DocumentoDte de una Factura Nacional (debe calzar con el service).
const ORIGEN_TIPO_DTE = 'factura-nacional'

const mantenedorSelect = { id: true, codigo: true, descripcion: true } as const

const facturaInclude = {
  cliente: {
    select: {
      id: true,
      codigo: true,
      descripcion: true,
      razonSocial: true,
      identificador: true,
      giro: true,
      tipos: true,
      direcciones: {
        where: { eliminadoEn: null },
        select: { direccion: true, comuna: { select: { descripcion: true } } },
        orderBy: [{ esPorDefecto: 'desc' as const }, { codigo: 'asc' as const }],
        take: 1,
      },
    },
  },
  moneda: { select: { id: true, codigo: true, descripcion: true, esMonedaBase: true } },
  condicionPago: { select: mantenedorSelect },
  proformaMaterial: { select: { id: true, numero: true, estado: true } },
  lineas: {
    select: {
      id: true,
      descripcion: true,
      articuloId: true,
      articulo: { select: { id: true, codigo: true, descripcion: true } },
      cantidad: true,
      precioUnitario: true,
      exento: true,
      montoLinea: true,
    },
    orderBy: { id: 'asc' as const },
  },
} satisfies Prisma.FacturaNacionalInclude

// Proforma de Materiales lista para facturar (ENVIADA_VALIDACION) con todo lo
// necesario para armar el borrador: cliente nacional (RUT=identificador), moneda,
// condición de pago y líneas (artículo/cantidad/precio).
export async function getProformaMaterialParaFactura(id: number) {
  return prisma.proformaMaterial.findFirst({
    where: { id, estado: 'ENVIADA_VALIDACION' },
    select: {
      id: true,
      numero: true,
      entidadId: true,
      monedaId: true,
      moneda: { select: { codigo: true, esMonedaBase: true } },
      condicionPagoId: true,
      observaciones: true,
      entidad: {
        select: {
          id: true,
          razonSocial: true,
          identificador: true,
          giro: true,
          tipos: true,
          direcciones: {
            where: { eliminadoEn: null },
            select: { direccion: true, comuna: { select: { descripcion: true } } },
            orderBy: [{ esPorDefecto: 'desc' }, { codigo: 'asc' }],
            take: 1,
          },
        },
      },
      lineas: {
        select: {
          articuloId: true,
          articulo: { select: { descripcion: true } },
          cantidad: true,
          precioUnitario: true,
        },
        orderBy: { id: 'asc' },
      },
    },
  })
}

// Resuelve qué articuloIds existen en la empresa activa (la extensión de tenancy
// acota Articulo por empresa) — para validar aislamiento al editar líneas.
export async function getArticulosIdsValidos(ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set()
  const articulos = await prisma.articulo.findMany({ where: { id: { in: ids } }, select: { id: true } })
  return new Set(articulos.map((a) => a.id))
}

export async function getFacturaActivaPorProforma(proformaMaterialId: number) {
  return prisma.facturaNacional.findFirst({
    where: { proformaMaterialId, eliminadoEn: null },
    select: { id: true, estado: true },
  })
}

export async function getFacturaActivaById(id: number) {
  return prisma.facturaNacional.findFirst({ where: { id, eliminadoEn: null }, include: facturaInclude })
}

export async function getFacturaByIdConHistorial(id: number) {
  return prisma.facturaNacional.findFirst({ where: { id }, include: facturaInclude })
}

export interface LineaPersistir {
  descripcion: string
  articuloId: number | null
  cantidad: number
  precioUnitario: number
  exento: boolean
  montoLinea: number
}

export interface CrearBorradorData {
  proformaMaterialId: number
  codigo: string
  clienteId: number
  monedaId: number
  condicionPagoId: number | null
  idioma: string
  tipoDte: number
  montoNeto: number
  montoExento: number
  montoIva: number
  montoTotal: number
  lineas: LineaPersistir[]
}

export async function crearBorrador(data: CrearBorradorData, creadoPorId: string) {
  const empresaId = getEmpresaIdActual()!
  return prisma.facturaNacional.create({
    data: {
      empresaId,
      origenClase: 'PROFORMA_MATERIAL',
      proformaMaterialId: data.proformaMaterialId,
      codigo: data.codigo,
      clienteId: data.clienteId,
      monedaId: data.monedaId,
      condicionPagoId: data.condicionPagoId,
      idioma: data.idioma,
      tipoDte: data.tipoDte,
      montoNeto: data.montoNeto,
      montoExento: data.montoExento,
      montoIva: data.montoIva,
      montoTotal: data.montoTotal,
      creadoPorId,
      lineas: { create: data.lineas.map((l) => ({ ...l })) },
    },
    include: facturaInclude,
  })
}

export interface ActualizarBorradorData {
  fechaDocumento?: Date | null
  observaciones?: string | null
  tipoDte?: number
  montoNeto?: number
  montoExento?: number
  montoIva?: number
  montoTotal?: number
  lineas?: LineaPersistir[]
}

export async function actualizarBorrador(id: number, data: ActualizarBorradorData) {
  return prisma.$transaction(async (tx) => {
    // Lock del origen DTE: la edición del borrador y la invalidación de su DTE
    // temporal descartable son atómicas, sin ventana con otra firma.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_DOCUMENTO_DTE_EMISION}::int, hashtext(${`${ORIGEN_TIPO_DTE}:${id}`}))`

    const dteEnCurso = await tx.documentoDte.findFirst({
      where: { origenTipo: ORIGEN_TIPO_DTE, origenId: id, estado: { in: ['EMITIENDO', 'GENERANDO', 'GENERADO'] } },
      select: { estado: true },
    })
    if (dteEnCurso) {
      throw new ValidationError('No se puede editar la Factura: su timbrado ante el SII está en curso o ya fue emitido. Recarga la página.')
    }
    const estadoActual = await tx.facturaNacional.findFirst({ where: { id }, select: { estado: true, eliminadoEn: true } })
    if (!estadoActual || estadoActual.eliminadoEn || estadoActual.estado !== 'BORRADOR') {
      throw new ValidationError('La Factura ya no está en un estado editable. Recarga la página.')
    }

    if (data.lineas !== undefined) {
      await tx.facturaNacionalLinea.deleteMany({ where: { facturaNacionalId: id } })
    }
    const factura = await tx.facturaNacional.update({
      where: { id },
      data: {
        ...(data.fechaDocumento !== undefined ? { fechaDocumento: data.fechaDocumento } : {}),
        ...(data.observaciones !== undefined ? { observaciones: data.observaciones } : {}),
        ...(data.tipoDte !== undefined ? { tipoDte: data.tipoDte } : {}),
        ...(data.montoNeto !== undefined ? { montoNeto: data.montoNeto } : {}),
        ...(data.montoExento !== undefined ? { montoExento: data.montoExento } : {}),
        ...(data.montoIva !== undefined ? { montoIva: data.montoIva } : {}),
        ...(data.montoTotal !== undefined ? { montoTotal: data.montoTotal } : {}),
        ...(data.lineas !== undefined ? { lineas: { create: data.lineas.map((l) => ({ ...l })) } } : {}),
      },
      include: facturaInclude,
    })
    // Descarta el DTE temporal descartable (nunca en vuelo/timbrado): el borrador
    // cambió, "Enviar borrador al SII" reconstruirá uno fresco.
    await tx.documentoDte.deleteMany({
      where: { origenTipo: ORIGEN_TIPO_DTE, origenId: id, estado: { in: ['TEMPORAL_CREADO', 'ERROR', 'PENDIENTE'] } },
    })
    return factura
  })
}

// Timbrada: marca APROBADA con folio y mueve la Proforma de origen a FACTURADA,
// atómicamente.
export async function marcarFirmada(
  id: number,
  datos: { folio: number; trackIdSii: string | null; fechaEmision: Date; fechaDocumento: Date; proformaMaterialId: number | null },
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    // FAS-FN-QA-007: mismo advisory lock del origen DTE que usa anularFactura —
    // firma y anulación quedan serializadas por el mismo candado.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_DOCUMENTO_DTE_EMISION}::int, hashtext(${`${ORIGEN_TIPO_DTE}:${id}`}))`
    const actual = await tx.facturaNacional.findUnique({
      where: { id },
      select: { estado: true, eliminadoEn: true },
    })
    if (!actual || actual.eliminadoEn) {
      throw new ValidationError('La Factura Nacional fue anulada — no se puede confirmar la firma')
    }
    if (actual.estado === 'APROBADA') {
      // Ya confirmada por otra ejecución concurrente — idempotente.
      return tx.facturaNacional.findUnique({ where: { id }, include: facturaInclude })
    }
    const factura = await tx.facturaNacional.update({
      where: { id },
      data: {
        estado: 'APROBADA',
        folio: datos.folio,
        trackIdSii: datos.trackIdSii,
        fechaEmision: datos.fechaEmision,
        fechaDocumento: datos.fechaDocumento,
        emitidoPorId: userId,
        emitidoEn: datos.fechaEmision,
        errorMensajeSii: null,
      },
      include: facturaInclude,
    })
    if (datos.proformaMaterialId != null) {
      // Exige atómicamente que la Proforma pase de ENVIADA_VALIDACION a FACTURADA
      // (FAS-FN-QA-007). El guard de anulación de Proforma impide que haya sido
      // anulada mientras existía esta factura, así que la transición es segura.
      const trans = await tx.proformaMaterial.updateMany({
        where: { id: datos.proformaMaterialId, estado: 'ENVIADA_VALIDACION' },
        data: { estado: 'FACTURADA' },
      })
      if (trans.count !== 1) {
        // No debería ocurrir (guard + índice único). Si ocurre, el DTE ya quedó
        // timbrado: se revierte la confirmación para no dejar factura APROBADA
        // sin Proforma facturada y se exige reconciliación manual.
        throw new ValidationError(
          'La Proforma de origen cambió de estado durante la firma — reconcilia el documento manualmente (el DTE pudo quedar timbrado)',
        )
      }
    }
    return factura
  })
}

export async function marcarRechazada(id: number, errorMensajeSii: string) {
  return prisma.facturaNacional.update({ where: { id }, data: { estado: 'RECHAZADA', errorMensajeSii } })
}

export async function reabrirBorrador(id: number) {
  return prisma.facturaNacional.update({ where: { id }, data: { estado: 'BORRADOR', errorMensajeSii: null }, include: facturaInclude })
}

export async function anularFactura(id: number, userId: string) {
  // Serializado con la firma por el mismo advisory lock del origen DTE
  // (FAS-FN-QA-008): no se anula si hay un DTE en vuelo/timbrado, para no dejar
  // un DTE real "huérfano" sobre una factura anulada. El temporal descartable se
  // elimina en la misma transacción.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_DOCUMENTO_DTE_EMISION}::int, hashtext(${`${ORIGEN_TIPO_DTE}:${id}`}))`

    const actual = await tx.facturaNacional.findFirst({ where: { id }, select: { estado: true, eliminadoEn: true } })
    if (!actual || actual.eliminadoEn) throw new ValidationError('La Factura ya no está disponible. Recarga la página.')
    if (actual.estado === 'APROBADA') {
      throw new ValidationError('No se puede anular una Factura ya aprobada (timbrada) — requiere una Nota de Crédito (próxima fase)')
    }
    const dteEnCurso = await tx.documentoDte.findFirst({
      where: { origenTipo: ORIGEN_TIPO_DTE, origenId: id, estado: { in: ['EMITIENDO', 'GENERANDO', 'GENERADO'] } },
      select: { estado: true },
    })
    if (dteEnCurso) {
      throw new ValidationError('No se puede anular la Factura: su timbrado ante el SII está en curso o ya fue emitido. Recarga la página.')
    }
    await tx.documentoDte.deleteMany({
      where: { origenTipo: ORIGEN_TIPO_DTE, origenId: id, estado: { in: ['TEMPORAL_CREADO', 'ERROR', 'PENDIENTE'] } },
    })
    return tx.facturaNacional.update({
      where: { id },
      data: { estado: 'ANULADA', eliminadoEn: new Date(), eliminadoPor: userId },
    })
  })
}

export async function listFacturas(filters: FacturasNacionalListFilters) {
  const { page = 1, limit = 20, estado, q } = filters
  const where: Prisma.FacturaNacionalWhereInput = {
    eliminadoEn: null,
    ...(estado ? { estado } : {}),
    ...(q ? { OR: [{ codigo: { contains: q, mode: 'insensitive' } }, { cliente: { razonSocial: { contains: q, mode: 'insensitive' } } }] } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.facturaNacional.findMany({
      where,
      include: facturaInclude,
      orderBy: { creadoEn: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.facturaNacional.count({ where }),
  ])
  return { data, total }
}

// Proformas de Materiales en ENVIADA_VALIDACION sin una Factura Nacional activa
// (para la landing: registros por facturar).
export async function listProformasFacturables(filters: { page?: number; limit?: number; q?: string }) {
  const { page = 1, limit = 20, q } = filters
  const where: Prisma.ProformaMaterialWhereInput = {
    estado: 'ENVIADA_VALIDACION',
    facturasNacional: { none: { eliminadoEn: null } },
    ...(q ? { OR: [{ numero: { contains: q, mode: 'insensitive' } }, { entidad: { razonSocial: { contains: q, mode: 'insensitive' } } }] } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.proformaMaterial.findMany({
      where,
      select: {
        id: true,
        numero: true,
        entidad: { select: { id: true, razonSocial: true } },
        moneda: { select: mantenedorSelect },
        _count: { select: { lineas: true } },
        creadoEn: true,
      },
      orderBy: { creadoEn: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.proformaMaterial.count({ where }),
  ])
  return { data, total }
}
