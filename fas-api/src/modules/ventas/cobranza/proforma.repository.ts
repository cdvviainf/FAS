import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import type { DimensionProforma, ProformasListFilters } from './proforma.types.js'

const mantenedorSelect = { id: true, codigo: true, descripcion: true }

// Datos del Embarque que necesita el módulo de Proforma — cliente/moneda/
// condiciónPago se heredan de la Nota de Venta (cobranza.md, D1/RC-D4-like).
export async function getEmbarqueParaProforma(embarqueId: number) {
  const embarque = await prisma.embarque.findFirst({
    where: { id: embarqueId, eliminadoEn: null },
    select: {
      id: true,
      numeroInstructivo: true,
      notaVentaId: true,
      // "Efectivamente despachado" (FAS-PROF-EXP-005, QA ronda 1) — mismo
      // criterio que embarques.repository.ts:confirmarDespacho/anularDespacho.
      despachadoEn: true,
      despachoAnuladoEn: true,
      // Fechas de referencia para la tabla de vencimientos estimada del PDF
      // (D6, resolvers/proforma.resolver.ts) — mismo criterio de resolución
      // manual/AGL360 que instructivo-embarque.resolver.ts.
      reservaManual: true,
      fechaZarpeManual: true,
      fechaArribo: true,
      solicitudReserva: { select: { fechaZarpe: true } },
      notaVenta: {
        select: {
          clienteId: true,
          cliente: { select: mantenedorSelect },
          monedaId: true,
          moneda: { select: mantenedorSelect },
          condicionPagoId: true,
        },
      },
    },
  })
  return embarque
}

// Líneas de los pallets reservados al Embarque, con descripciones — base para
// armar las líneas agrupadas sugeridas de la Proforma (cobranza.md §7).
export async function getPalletsReservadosConDetalle(embarqueId: number) {
  return prisma.pallet.findMany({
    where: { embarqueId },
    select: {
      lineas: {
        select: {
          especieId: true,
          especie: { select: mantenedorSelect },
          variedadId: true,
          variedad: { select: mantenedorSelect },
          categoriaId: true,
          categoria: { select: mantenedorSelect },
          articuloId: true,
          articulo: { select: mantenedorSelect },
          calibreId: true,
          calibre: { select: mantenedorSelect },
          etiquetaId: true,
          etiqueta: { select: mantenedorSelect },
          cajas: true,
        },
      },
    },
  })
}

// Nota de Venta con su detalle (precio por línea) + calibres multiselect —
// mismo shape que embarques.repository.ts:getNotaVentaConDetalle, reusado
// acá para no duplicar el include (misma tabla, mismo criterio de calce que
// embarques.comparacion.ts).
export async function getNotaVentaParaPrecios(notaVentaId: number) {
  return prisma.notaVenta.findFirst({
    where: { id: notaVentaId, eliminadoEn: null },
    select: {
      detalles: {
        select: {
          especieId: true,
          variedadId: true,
          articuloId: true,
          categoriaId: true,
          precio: true,
          calibres: { select: { calibreId: true } },
        },
      },
    },
  })
}

// Cuotas snapshoteadas al Cierre Comercial (ventas.md R12) — base de la
// tabla de vencimientos estimada del PDF de la Proforma (D4/D6), no la
// plantilla genérica de CondicionPagoCuota.
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
    orderBy: { id: 'asc' }, // orden de creación = orden de cuota (sin numeroCuota propio)
  })
}

const proformaInclude = {
  cliente: { select: mantenedorSelect },
  moneda: { select: mantenedorSelect },
  condicionPago: { select: mantenedorSelect },
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
} satisfies Prisma.ProformaInclude

export async function getProformaActivaPorEmbarque(embarqueId: number) {
  return prisma.proforma.findFirst({
    where: { embarqueId, eliminadoEn: null },
    include: proformaInclude,
  })
}

// Solo la Proforma ACTIVA — usada por el resolver del Motor de Documentos
// (una Proforma anulada no debe seguir siendo descargable, mismo criterio
// que InstructivoHijo tras "Anular Despacho").
export async function getProformaById(id: number) {
  return prisma.proforma.findFirst({ where: { id, eliminadoEn: null }, include: proformaInclude })
}

// Detalle con historial (FAS-PROF-EXP-003, QA ronda 1): una Proforma
// ANULADA sigue siendo consultable (CB16, "nunca se elimina") — solo su PDF
// queda bloqueado (ver getProformaById arriba).
export async function getProformaByIdConHistorial(id: number) {
  return prisma.proforma.findFirst({ where: { id }, include: proformaInclude })
}

export async function listProformas(filters: ProformasListFilters) {
  const { page = 1, limit = 20, embarqueId, clienteId, estado, folio } = filters
  const where = {
    ...(embarqueId ? { embarqueId } : {}),
    ...(clienteId ? { clienteId } : {}),
    ...(estado ? { estado } : {}),
    // FAS-PROF-EXP-004 (QA ronda 1): filtro server-side, no post-paginación
    // en el cliente — mismo criterio que reclamos.repository.ts:listReclamos.
    ...(folio ? { embarque: { numeroInstructivo: { contains: folio, mode: 'insensitive' as const } } } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.proforma.findMany({
      where,
      include: proformaInclude,
      orderBy: { creadoEn: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.proforma.count({ where }),
  ])
  return { data, total }
}

interface DatosCrearProforma {
  embarqueId: number
  codigo: string
  clienteId: number
  monedaId: number
  condicionPagoId: number | null
  montoTotal: number
}

// Línea ya validada y derivada por el service (precioUnitario editado por el
// usuario; montoLinea = precioUnitario × cantidadCajas redondeado a 2). El
// repo solo persiste — no vuelve a calcular montos.
export interface LineaProformaPersistir {
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

interface MetaCrearProforma {
  idioma: string
  dimensiones: DimensionProforma[]
  lineas: LineaProformaPersistir[]
}

export async function crearProforma(datos: DatosCrearProforma, meta: MetaCrearProforma, creadoPorId: string) {
  const empresaId = getEmpresaIdActual()!
  return prisma.proforma.create({
    data: {
      empresaId,
      embarqueId: datos.embarqueId,
      codigo: datos.codigo,
      clienteId: datos.clienteId,
      monedaId: datos.monedaId,
      condicionPagoId: datos.condicionPagoId,
      idioma: meta.idioma,
      dimensionesAgrupacion: meta.dimensiones,
      montoTotal: datos.montoTotal,
      creadoPorId,
      lineas: {
        create: meta.lineas.map((l) => ({
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
        })),
      },
    },
    include: proformaInclude,
  })
}

// "Anular Proforma" = soft delete (mismo criterio que el resto del sistema) —
// libera el índice único parcial (empresaId, embarqueId) para poder reemitir.
// El check de "existe y está activa" vive en el service (getProformaById);
// acá no se refiltra por eliminadoEn para poder devolver el registro ya
// anulado con su include completo.
export async function anularProforma(id: number, actualizadoPor: string) {
  return prisma.proforma.update({
    where: { id },
    data: { estado: 'ANULADA', eliminadoEn: new Date(), eliminadoPor: actualizadoPor },
    include: proformaInclude,
  })
}
