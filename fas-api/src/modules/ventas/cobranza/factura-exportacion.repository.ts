import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import type { DimensionProforma, FacturasExportacionListFilters } from './factura-exportacion.types.js'

const mantenedorSelect = { id: true, codigo: true, descripcion: true }

const facturaInclude = {
  cliente: { select: mantenedorSelect },
  moneda: { select: mantenedorSelect },
  condicionPago: { select: mantenedorSelect },
  proforma: { select: { id: true, codigo: true } },
  embarque: { select: { id: true, numeroInstructivo: true } },
  lineas: {
    select: {
      id: true,
      descripcion: true,
      especieId: true,
      variedadId: true,
      articuloId: true,
      calibreId: true,
      categoriaId: true,
      etiquetaId: true,
      cantidadCajas: true,
      precioUnitario: true,
      montoLinea: true,
    },
  },
  cuotas: {
    select: {
      id: true,
      numeroCuota: true,
      fechaReferencia: true,
      plazoDias: true,
      montoCuota: true,
      fechaVencimiento: true,
      estado: true,
    },
    orderBy: { numeroCuota: 'asc' as const },
  },
} satisfies Prisma.FacturaExportacionInclude

// Proforma de origen (debe estar EMITIDA/activa) — su detalle es el punto de
// partida editable de la Factura.
export async function getProformaEmitidaParaFactura(proformaId: number) {
  return prisma.proforma.findFirst({
    where: { id: proformaId, eliminadoEn: null },
    select: {
      id: true,
      estado: true,
      embarqueId: true,
      clienteId: true,
      monedaId: true,
      condicionPagoId: true,
      dimensionesAgrupacion: true,
      lineas: {
        select: {
          descripcion: true,
          especieId: true,
          variedadId: true,
          articuloId: true,
          calibreId: true,
          categoriaId: true,
          etiquetaId: true,
          cantidadCajas: true,
          precioUnitario: true,
          montoLinea: true,
        },
      },
    },
  })
}

// Datos del Embarque + Nota de Venta necesarios para armar el DTE 110 (Aduana,
// moneda extranjera, país/puertos, fechas de referencia de cuotas).
export async function getEmbarqueParaFacturaDte(embarqueId: number) {
  return prisma.embarque.findFirst({
    where: { id: embarqueId, eliminadoEn: null },
    select: {
      id: true,
      numeroInstructivo: true,
      notaVentaId: true,
      despachadoEn: true,
      despachoAnuladoEn: true,
      reservaManual: true,
      fechaZarpeManual: true,
      fechaArribo: true,
      solicitudReserva: { select: { fechaZarpe: true } },
      puertoZarpe: { select: { codigo: true } },
      notaVenta: {
        select: {
          clienteId: true,
          cliente: { select: { id: true, razonSocial: true, identificador: true, giro: true } },
          monedaId: true,
          moneda: { select: { codigo: true, descripcion: true, descripcionExtranjera: true } },
          condicionPagoId: true,
          tipoEmbarque: { select: { codigo: true } },
          paisDestino: { select: { codigo: true } },
          puertoDestino: { select: { codigo: true } },
          modalidadVenta: { select: { codigo: true } },
          clausulaVenta: { select: { codigo: true } },
        },
      },
    },
  })
}

// Cuotas snapshoteadas del Cierre Comercial — misma fuente que Proforma.
export async function getCuotasPagoNotaVenta(notaVentaId: number) {
  return prisma.notaVentaCuotaPago.findMany({
    where: { notaVentaId },
    select: {
      descripcion: true,
      fechaReferencia: true,
      plazoDias: true,
      tipoValor: true,
      porcentaje: true,
      montoCalculado: true,
    },
    orderBy: { id: 'asc' },
  })
}

export async function getFacturaActivaPorEmbarque(embarqueId: number) {
  return prisma.facturaExportacion.findFirst({
    where: { embarqueId, eliminadoEn: null },
    include: facturaInclude,
  })
}

export async function getFacturaByIdConHistorial(id: number) {
  return prisma.facturaExportacion.findFirst({ where: { id }, include: facturaInclude })
}

export async function getFacturaActivaById(id: number) {
  return prisma.facturaExportacion.findFirst({ where: { id, eliminadoEn: null }, include: facturaInclude })
}

export interface LineaFacturaPersistir {
  descripcion: string
  especieId: number
  variedadId: number | null
  articuloId: number | null
  calibreId: number | null
  categoriaId: number | null
  etiquetaId: number | null
  cantidadCajas: number
  precioUnitario: number
  montoLinea: number
}

interface DatosCrearFactura {
  embarqueId: number
  proformaId: number
  codigo: string
  clienteId: number
  monedaId: number
  condicionPagoId: number | null
  dimensiones: DimensionProforma[]
  montoTotal: number
  lineas: LineaFacturaPersistir[]
}

export async function crearBorrador(datos: DatosCrearFactura, creadoPorId: string) {
  const empresaId = getEmpresaIdActual()!
  return prisma.facturaExportacion.create({
    data: {
      empresaId,
      embarqueId: datos.embarqueId,
      proformaId: datos.proformaId,
      codigo: datos.codigo,
      clienteId: datos.clienteId,
      monedaId: datos.monedaId,
      condicionPagoId: datos.condicionPagoId,
      dimensionesAgrupacion: datos.dimensiones,
      montoTotal: datos.montoTotal,
      estado: 'BORRADOR',
      creadoPorId,
      lineas: { create: datos.lineas.map(toLineaCreate) },
    },
    include: facturaInclude,
  })
}

function toLineaCreate(l: LineaFacturaPersistir) {
  return {
    descripcion: l.descripcion,
    especieId: l.especieId,
    variedadId: l.variedadId ?? undefined,
    articuloId: l.articuloId ?? undefined,
    calibreId: l.calibreId ?? undefined,
    categoriaId: l.categoriaId ?? undefined,
    etiquetaId: l.etiquetaId ?? undefined,
    cantidadCajas: l.cantidadCajas,
    precioUnitario: l.precioUnitario,
    montoLinea: l.montoLinea,
  }
}

// Reemplaza líneas + dimensiones + total de un BORRADOR (borra las anteriores y
// recrea) en una transacción.
export async function actualizarBorrador(
  id: number,
  dimensiones: DimensionProforma[],
  montoTotal: number,
  lineas: LineaFacturaPersistir[],
  actualizadoPor: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.facturaExportacionLinea.deleteMany({ where: { facturaExportacionId: id } })
    await tx.facturaExportacion.update({
      where: { id },
      data: {
        dimensionesAgrupacion: dimensiones,
        montoTotal,
        lineas: { create: lineas.map(toLineaCreate) },
      },
    })
    return tx.facturaExportacion.findFirst({ where: { id }, include: facturaInclude })
  })
}

export interface CuotaPersistir {
  numeroCuota: number
  fechaReferencia: 'FACTURA' | 'ZARPE' | 'ENVIO_DOCUMENTOS' | 'ARRIBO'
  plazoDias: number
  montoCuota: number
  fechaVencimiento: Date | null
}

// Marca la Factura como EMITIDA con el folio/trackId del DTE y crea sus Cuotas,
// todo en una transacción (los efectos de negocio son atómicos; la llamada a
// LibreDTE ya ocurrió antes, fuera de la transacción).
export async function marcarEmitida(
  id: number,
  datos: { folio: number | null; trackIdSii: string | null; fechaEmision: Date; cuotas: CuotaPersistir[] },
  emitidoPorId: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.facturaExportacion.update({
      where: { id },
      data: {
        estado: 'EMITIDA',
        folio: datos.folio,
        trackIdSii: datos.trackIdSii,
        fechaEmision: datos.fechaEmision,
        emitidoPorId,
        emitidoEn: new Date(),
        cuotas: {
          create: datos.cuotas.map((c) => ({
            numeroCuota: c.numeroCuota,
            fechaReferencia: c.fechaReferencia,
            plazoDias: c.plazoDias,
            montoCuota: c.montoCuota,
            fechaVencimiento: c.fechaVencimiento ?? undefined,
          })),
        },
      },
    })
    return tx.facturaExportacion.findFirst({ where: { id }, include: facturaInclude })
  })
}

export async function anularFactura(id: number, eliminadoPor: string) {
  return prisma.facturaExportacion.update({
    where: { id },
    data: { estado: 'ANULADA', eliminadoEn: new Date(), eliminadoPor },
    include: facturaInclude,
  })
}

export async function listFacturas(filters: FacturasExportacionListFilters) {
  const { page = 1, limit = 20, embarqueId, clienteId, estado, folio } = filters
  const where: Prisma.FacturaExportacionWhereInput = {
    ...(estado ? { estado } : { eliminadoEn: null }),
    ...(embarqueId ? { embarqueId } : {}),
    ...(clienteId ? { clienteId } : {}),
    ...(folio ? { embarque: { numeroInstructivo: { contains: folio, mode: 'insensitive' as const } } } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.facturaExportacion.findMany({
      where,
      include: facturaInclude,
      orderBy: { creadoEn: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.facturaExportacion.count({ where }),
  ])
  return { data, total }
}
