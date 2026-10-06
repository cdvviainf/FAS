import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { LOCK_NAMESPACE_DOCUMENTO_DTE_EMISION } from '../../../shared/advisory-locks.js'
import { ValidationError } from '../../../shared/errors.js'
import type { DimensionProforma, FacturasExportacionListFilters } from './factura-exportacion.types.js'

// origenTipo del DocumentoDte de una Factura de Exportación (debe calzar con el
// del service que emite/timbra) — para invalidar su temporal al editar.
const ORIGEN_TIPO_DTE = 'factura-exportacion'

const mantenedorSelect = { id: true, codigo: true, descripcion: true }
// Descripciones ES/EN de un mantenedor referenciado por una línea — base para
// construir la descripción según idioma (ver descripcion-idioma.ts).
const descSelect = { select: { descripcion: true, descripcionExtranjera: true } }

const facturaInclude = {
  cliente: { select: mantenedorSelect },
  moneda: { select: mantenedorSelect },
  condicionPago: { select: mantenedorSelect },
  proforma: { select: { id: true, codigo: true } },
  embarque: {
    select: {
      id: true,
      numeroInstructivo: true,
      notaVentaId: true,
      // Flags de la cláusula de venta (Incoterm) — el editor los usa para
      // mostrar/exigir los inputs de Flete/Seguro.
      notaVenta: {
        select: {
          clausulaVenta: {
            select: { descripcion: true, requiereFlete: true, requiereSeguro: true },
          },
        },
      },
    },
  },
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
      // Relaciones para reconstruir la descripción por idioma (ES/EN).
      especie: descSelect,
      variedad: descSelect,
      articulo: descSelect,
      calibre: descSelect,
      categoria: descSelect,
      etiqueta: descSelect,
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
      idioma: true,
      fechaDocumento: true,
      montoFlete: true,
      montoSeguro: true,
      observaciones: true,
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
          especie: descSelect,
          variedad: descSelect,
          articulo: descSelect,
          calibre: descSelect,
          categoria: descSelect,
          etiqueta: descSelect,
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
      // Transporte/booking del DTE 110: según `reservaManual` (arriba) se toman
      // los campos *Manual del Embarque o los de la SolicitudReserva (AGL360).
      naveManual: true,
      numeroBookingManual: true,
      numeroContenedorManual: true,
      awbBl: true,
      naviera: { select: { razonSocial: true } },
      solicitudReserva: { select: { fechaZarpe: true, nave: true, numeroBooking: true, numeroContenedor: true } },
      puertoZarpe: { select: { codigo: true, descripcion: true, codigoAduana: true } },
      notaVenta: {
        select: {
          clienteId: true,
          // Tipo de venta (2026-10-06): una NV NACIONAL no puede generar Factura
          // de Exportación (DTE 110) — guard en el service.
          tipoVenta: true,
          cliente: { select: { id: true, razonSocial: true, identificador: true, giro: true } },
          monedaId: true,
          moneda: { select: { codigo: true, descripcion: true, descripcionExtranjera: true, esMonedaBase: true } },
          condicionPagoId: true,
          tipoEmbarque: { select: { codigo: true, descripcion: true, codigoAduana: true } },
          paisDestino: { select: { codigo: true, descripcion: true, codigoAduana: true } },
          puertoDestino: { select: { codigo: true, descripcion: true, codigoAduana: true } },
          modalidadVenta: { select: { codigo: true, descripcion: true, codigoAduana: true } },
          clausulaVenta: { select: { codigo: true, descripcion: true, codigoAduana: true, requiereFlete: true, requiereSeguro: true } },
        },
      },
    },
  })
}

// Peso del embarque para el DTE 110: cada PalletLinea tiene su embalaje
// (Articulo, kgNeto/BrutoEnvase) y cajas. Se calcula desde los pallets físicos,
// no desde las líneas de la Factura (que pueden estar agrupadas SIN artículo →
// sin peso). Devuelve cajas + pesos por línea; el service suma.
export async function getLineasPalletParaPeso(embarqueId: number) {
  return prisma.palletLinea.findMany({
    where: { pallet: { embarqueId } },
    select: { cajas: true, articulo: { select: { kgNetoEnvase: true, kgBrutoEnvase: true } } },
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
  idioma: string
  fechaDocumento: Date | null
  montoTotal: number
  montoFlete: number | null
  montoSeguro: number | null
  tipoCambio: number | null
  fechaTipoCambio: Date | null
  observaciones: string | null
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
      idioma: datos.idioma,
      fechaDocumento: datos.fechaDocumento,
      montoTotal: datos.montoTotal,
      montoFlete: datos.montoFlete,
      montoSeguro: datos.montoSeguro,
      tipoCambio: datos.tipoCambio,
      fechaTipoCambio: datos.fechaTipoCambio,
      observaciones: datos.observaciones,
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
  datos: {
    dimensiones: DimensionProforma[]
    idioma: string
    fechaDocumento: Date | null
    montoTotal: number
    montoFlete: number | null
    montoSeguro: number | null
    tipoCambio: number | null
    fechaTipoCambio: Date | null
    observaciones: string | null
    lineas: LineaFacturaPersistir[]
  },
  actualizadoPor: string,
) {
  return prisma.$transaction(async (tx) => {
    // Bajo el MISMO advisory lock por origen que emitir/firmar: la actualización
    // del borrador y la invalidación de su DTE temporal descartable ocurren como
    // una sola transición atómica, sin ventana con otra firma (FAS-COB-F1-001).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_DOCUMENTO_DTE_EMISION}::int, hashtext(${`${ORIGEN_TIPO_DTE}:${id}`}))`

    // Re-verificación DENTRO del lock (FAS-COB-F1-001): aborta sin escribir si hay
    // un timbrado en curso/terminal o la factura ya no es editable — evita editar
    // una factura mientras LibreDTE timbra el payload anterior (firmar libera el
    // lock durante la llamada externa) y aprobar luego datos que no calzan con el DTE.
    const dteEnCurso = await tx.documentoDte.findFirst({
      where: { origenTipo: ORIGEN_TIPO_DTE, origenId: id, estado: { in: ['EMITIENDO', 'GENERANDO', 'GENERADO'] } },
      select: { estado: true },
    })
    if (dteEnCurso) {
      throw new ValidationError('No se puede editar la Factura: su timbrado ante el SII está en curso o ya fue emitido. Recarga la página.')
    }
    const estadoActual = await tx.facturaExportacion.findFirst({ where: { id }, select: { estado: true, eliminadoEn: true } })
    if (!estadoActual || estadoActual.eliminadoEn || (estadoActual.estado !== 'BORRADOR' && estadoActual.estado !== 'RECHAZADA')) {
      throw new ValidationError('La Factura ya no está en un estado editable. Recarga la página.')
    }

    await tx.facturaExportacionLinea.deleteMany({ where: { facturaExportacionId: id } })
    await tx.facturaExportacion.update({
      where: { id },
      data: {
        dimensionesAgrupacion: datos.dimensiones,
        idioma: datos.idioma,
        fechaDocumento: datos.fechaDocumento,
        montoTotal: datos.montoTotal,
        montoFlete: datos.montoFlete,
        montoSeguro: datos.montoSeguro,
        tipoCambio: datos.tipoCambio,
        fechaTipoCambio: datos.fechaTipoCambio,
        observaciones: datos.observaciones,
        lineas: { create: datos.lineas.map(toLineaCreate) },
      },
    })
    // Descarta el temporal descartable (nunca en vuelo/timbrado) — el borrador
    // cambió, así que "Enviar borrador al SII" reconstruirá uno fresco.
    await tx.documentoDte.deleteMany({
      where: { origenTipo: ORIGEN_TIPO_DTE, origenId: id, estado: { in: ['TEMPORAL_CREADO', 'ERROR', 'PENDIENTE'] } },
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

// Marca la Factura como APROBADA (timbrada) con el folio/trackId del DTE y crea
// sus Cuotas, todo en una transacción (los efectos de negocio son atómicos; la
// llamada a LibreDTE ya ocurrió antes, fuera de la transacción). Limpia un
// posible errorMensajeSii de un intento previo rechazado.
export async function marcarFirmada(
  id: number,
  datos: { folio: number | null; trackIdSii: string | null; fechaEmision: Date; fechaDocumento: Date; cuotas: CuotaPersistir[] },
  emitidoPorId: string,
) {
  return prisma.$transaction(async (tx) => {
    // Idempotente: si la firma se reconcilia tras un éxito parcial, borra las
    // cuotas previas antes de recrearlas para no duplicarlas (FAS-COB-F1-005).
    await tx.facturaExportacionCuota.deleteMany({ where: { facturaExportacionId: id } })
    await tx.facturaExportacion.update({
      where: { id },
      data: {
        estado: 'APROBADA',
        folio: datos.folio,
        trackIdSii: datos.trackIdSii,
        fechaEmision: datos.fechaEmision,
        fechaDocumento: datos.fechaDocumento,
        errorMensajeSii: null,
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

// Marca la Factura como RECHAZADA guardando el motivo del SII/LibreDTE. Sigue
// siendo recuperable: el usuario puede volver a "Enviar borrador"/"Firmar".
export async function marcarRechazada(id: number, errorMensajeSii: string) {
  return prisma.facturaExportacion.update({
    where: { id },
    data: { estado: 'RECHAZADA', errorMensajeSii },
    include: facturaInclude,
  })
}

// Vuelve una Factura RECHAZADA a BORRADOR para reintentar el flujo SII.
export async function reabrirBorrador(id: number) {
  return prisma.facturaExportacion.update({
    where: { id },
    data: { estado: 'BORRADOR', errorMensajeSii: null },
    include: facturaInclude,
  })
}

export async function anularFactura(id: number, eliminadoPor: string) {
  return prisma.facturaExportacion.update({
    where: { id },
    data: { estado: 'ANULADA', eliminadoEn: new Date(), eliminadoPor },
    include: facturaInclude,
  })
}

// ─── Listado embarque-céntrico (landing de Exportación) ──────────────────────
// Embarques EFECTIVAMENTE despachados (despachadoEn != null && despachoAnuladoEn
// == null) con el estado de su Proforma y Factura activas (a lo más una de cada
// una por Embarque). Filtros: folio (numeroInstructivo) y cliente.
export interface EmbarquesExportacionFilters {
  page?: number
  limit?: number
  folio?: string
  clienteId?: number
}

export async function listEmbarquesDespachados(filters: EmbarquesExportacionFilters) {
  const { page = 1, limit = 20, folio, clienteId } = filters
  const where: Prisma.EmbarqueWhereInput = {
    eliminadoEn: null,
    despachadoEn: { not: null },
    despachoAnuladoEn: null,
    ...(folio ? { numeroInstructivo: { contains: folio, mode: 'insensitive' as const } } : {}),
    ...(clienteId ? { notaVenta: { clienteId } } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.embarque.findMany({
      where,
      select: {
        id: true,
        numeroInstructivo: true,
        despachadoEn: true,
        notaVenta: { select: { clienteId: true, cliente: { select: { id: true, razonSocial: true } } } },
        proformas: {
          where: { eliminadoEn: null },
          select: { id: true, codigo: true, estado: true },
          take: 1,
        },
        facturasExportacion: {
          where: { eliminadoEn: null },
          select: { id: true, codigo: true, estado: true, folio: true },
          take: 1,
        },
      },
      orderBy: { despachadoEn: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.embarque.count({ where }),
  ])
  return { data, total }
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
