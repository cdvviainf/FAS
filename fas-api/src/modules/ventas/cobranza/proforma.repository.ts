import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import type { DimensionProforma, ProformasListFilters } from './proforma.types.js'

const mantenedorSelect = { id: true, codigo: true, descripcion: true }
// Descripciones ES/EN de un mantenedor referenciado por una línea — para
// construir la descripción según idioma (descripcion-idioma.ts).
const descSelect = { select: { descripcion: true, descripcionExtranjera: true } }

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
          // Cláusula de venta (Incoterm) + flags que determinan si se exige
          // Flete/Seguro al proformar/facturar (ver Parametro.requiereFlete/
          // requiereSeguro).
          clausulaVenta: {
            select: { descripcion: true, requiereFlete: true, requiereSeguro: true },
          },
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
  embarque: { select: { id: true, numeroInstructivo: true, notaVentaId: true } },
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
  fechaDocumento: Date | null
  montoTotal: number
  montoFlete: number | null
  montoSeguro: number | null
  observaciones: string | null
}

// Descripciones ES/EN de los mantenedores referenciados por las líneas — para
// validar/armar la descripción por idioma antes de que exista la Proforma.
interface LineaIds {
  especieId: number
  variedadId: number | null
  articuloId: number | null
  calibreId: number | null
  categoriaId: number | null
  etiquetaId: number | null
}
export async function getDescripcionesMantenedores(lineas: LineaIds[]) {
  const uniq = (arr: (number | null)[]) => [...new Set(arr.filter((x): x is number => x != null))]
  const sel = { id: true, descripcion: true, descripcionExtranjera: true }
  const [esp, vari, art, cal, cat, eti] = await Promise.all([
    prisma.especie.findMany({ where: { id: { in: uniq(lineas.map((l) => l.especieId)) } }, select: sel }),
    prisma.variedad.findMany({ where: { id: { in: uniq(lineas.map((l) => l.variedadId)) } }, select: sel }),
    prisma.articulo.findMany({ where: { id: { in: uniq(lineas.map((l) => l.articuloId)) } }, select: sel }),
    prisma.calibre.findMany({ where: { id: { in: uniq(lineas.map((l) => l.calibreId)) } }, select: sel }),
    prisma.categoria.findMany({ where: { id: { in: uniq(lineas.map((l) => l.categoriaId)) } }, select: sel }),
    prisma.etiqueta.findMany({ where: { id: { in: uniq(lineas.map((l) => l.etiquetaId)) } }, select: sel }),
  ])
  type Row = { id: number; descripcion: string; descripcionExtranjera: string | null }
  const mapa = (rows: Row[]) => new Map(rows.map((r) => [r.id, { descripcion: r.descripcion, descripcionExtranjera: r.descripcionExtranjera }]))
  const [me, mv, ma, mc, mca, met] = [mapa(esp), mapa(vari), mapa(art), mapa(cal), mapa(cat), mapa(eti)]
  return lineas.map((l) => ({
    especie: me.get(l.especieId) ?? { descripcion: '', descripcionExtranjera: null },
    variedad: l.variedadId != null ? mv.get(l.variedadId) ?? null : null,
    articulo: l.articuloId != null ? ma.get(l.articuloId) ?? null : null,
    calibre: l.calibreId != null ? mc.get(l.calibreId) ?? null : null,
    categoria: l.categoriaId != null ? mca.get(l.categoriaId) ?? null : null,
    etiqueta: l.etiquetaId != null ? met.get(l.etiquetaId) ?? null : null,
  }))
}

// Factura de Exportación ACTIVA del Embarque (para bloquear la anulación de la
// Proforma mientras exista una Factura) — null si no hay.
export async function getFacturaActivaEmbarque(embarqueId: number) {
  return prisma.facturaExportacion.findFirst({
    where: { embarqueId, eliminadoEn: null },
    select: { id: true, codigo: true, estado: true },
  })
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
      fechaDocumento: datos.fechaDocumento,
      montoTotal: datos.montoTotal,
      montoFlete: datos.montoFlete,
      montoSeguro: datos.montoSeguro,
      observaciones: datos.observaciones,
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
