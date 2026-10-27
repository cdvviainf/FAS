import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { ValidationError } from '../../../shared/errors.js'
import { LOCK_NAMESPACE_ORDEN_COMPRA_PROCESO, LOCK_NAMESPACE_NOTA_VENTA_DETALLE } from '../../../shared/advisory-locks.js'
import type {
  OrdenCompraCreateInput,
  OrdenCompraUpdateInput,
  OrdenCompraLineaCreateInput,
  OrdenCompraLineaUpdateInput,
} from './ordenes-compra.types.js'

const entidadSelect = { id: true, codigo: true, descripcion: true, razonSocial: true }
// descripcionExtranjera: la usa el PDF de la OC para emitir en inglés
// (2026-10-26); es un campo extra inofensivo para los demás consumidores.
const mantenedorSelect = { id: true, codigo: true, descripcion: true, descripcionExtranjera: true }

const includeDetalle = {
  entidadProductor: { select: entidadSelect },
  notaVenta: { select: { id: true, folio: true } },
  // N:M (2026-08-22, Etapa 2) — reemplaza el solicitudInspeccion singular.
  solicitudes: {
    select: { id: true, solicitudInspeccion: { select: { id: true, codigo: true, estado: true } } },
    orderBy: { id: 'asc' as const },
  },
  moneda: { select: mantenedorSelect },
  formaPago: { select: mantenedorSelect },
  destinoMercado: { select: mantenedorSelect },
  incoterm: { select: mantenedorSelect },
  responsable: { select: { id: true, nombre: true, email: true } },
  condicionPago: {
    select: { id: true, codigo: true, descripcion: true },
  },
  lineas: {
    include: {
      especie: { select: mantenedorSelect },
      variedad: { select: mantenedorSelect },
      categoria: { select: mantenedorSelect },
      articulo: { select: { id: true, codigo: true, descripcion: true, descripcionExtranjera: true, etiqueta: true, kgNetoEnvase: true, kgBrutoEnvase: true } },
      etiqueta: { select: mantenedorSelect },
      calibres: { select: { calibre: { select: mantenedorSelect } } },
      tipoPallet: { select: mantenedorSelect },
    },
  },
  cuotasPago: {
    include: {
      moneda: { select: mantenedorSelect },
      unidad: { select: mantenedorSelect },
    },
  },
}

export async function listOrdenesCompra(page: number, limit: number, entidadProductorId?: number, estado?: string) {
  const where = {
    eliminadoEn: null,
    ...(entidadProductorId ? { entidadProductorId } : {}),
    ...(estado ? { estado: estado as 'BORRADOR' | 'EMITIDA' | 'RECEPCIONADA' } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.ordenCompra.findMany({
      where,
      include: {
        entidadProductor: { select: entidadSelect },
        moneda: { select: mantenedorSelect },
        notaVenta: { select: { id: true, folio: true } },
      },
      orderBy: { id: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.ordenCompra.count({ where }),
  ])

  return { data, total }
}

export async function getOrdenCompraById(id: number) {
  return prisma.ordenCompra.findFirst({ where: { id, eliminadoEn: null }, include: includeDetalle })
}

const LOCK_NAMESPACE_ORDEN_COMPRA = 490236

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any

// QA-RCV-007: el chequeo de "editable" (estado !== RECEPCIONADA) en el
// service corre ANTES de esta transacción — no es atómico con la mutación.
// Toma el mismo lock por ordenCompraId que recepciones.repository.ts usa
// para crear pallets, y vuelve a leer el estado ya bajo ese lock: sirve
// tanto para serializar dos ediciones concurrentes entre sí como para
// serializar una edición contra una Recepción en curso.
async function lockYVerificarEditable(tx: Tx, ordenCompraId: number): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_ORDEN_COMPRA_PROCESO}::int, ${ordenCompraId}::int)`
  // eliminadoEn: null — QA-RCV-008 (ronda 5): sin este filtro, una edición
  // en curso podía completarse igual sobre una OC que otra solicitud
  // eliminó (soft delete) mientras esperaba el lock — findUniqueOrThrow por
  // id solo no distingue una fila borrada de una activa.
  const actual = await tx.ordenCompra.findFirst({ where: { id: ordenCompraId, eliminadoEn: null }, select: { estado: true } })
  if (!actual) {
    throw new ValidationError('La Orden de Compra ya no existe')
  }
  if (actual.estado === 'RECEPCIONADA') {
    throw new ValidationError('La Orden de Compra ya fue recepcionada y no puede editarse')
  }
}

// Cantidad real de la OC para las cuotas MONTO_UNITARIO (valorUnitario ×
// cantidad). Depende de la modalidad:
//
// - CAJAS: suma cajas totales (columna `cajas`, no `cantidadPallets ×
//   cajasPorPallet` — cajasPorPallet es solo referencial). Si la unidad de la
//   cuota es "KG", convierte a kilos usando el kgNetoEnvase del artículo
//   (embalaje) de cada línea — rechaza (422) si algún artículo no tiene peso
//   cargado, en vez de valorizar en cero en silencio (FAS-PMQ-R1-003).
// - GRANEL (2026-10-23): la fruta se compra por kilos; la cantidad real = suma
//   de `cantidadKilos`. En granel una cuota MONTO_UNITARIO solo tiene sentido en
//   Kilo (no hay cajas) — se rechaza cualquier otra unidad.
async function calcularCantidadReal(
  tx: Tx,
  lineas: { cajas: number | null; cantidadKilos: Prisma.Decimal | null; articuloId: number }[],
  unidadId: number,
  modalidad: 'CAJAS' | 'GRANEL',
): Promise<Prisma.Decimal> {
  const unidad = await tx.unidadMedida.findUnique({ where: { id: unidadId }, select: { codigo: true } })

  if (modalidad === 'GRANEL') {
    if (unidad?.codigo !== 'KG') {
      throw new ValidationError(
        'En modalidad granel la cuota por monto unitario debe estar expresada en Kilo (KG) — la compra es por kilos, no por cajas',
      )
    }
    let total = new Prisma.Decimal(0)
    for (const l of lineas) {
      total = total.plus(l.cantidadKilos ?? new Prisma.Decimal(0))
    }
    return total
  }

  const totalCajas = lineas.reduce((acc, l) => acc + (l.cajas ?? 0), 0)
  if (unidad?.codigo !== 'KG') return new Prisma.Decimal(totalCajas)

  const articuloIds = [...new Set(lineas.map((l) => l.articuloId))]
  const articulos: { id: number; kgNetoEnvase: Prisma.Decimal | null }[] = await tx.articulo.findMany({
    where: { id: { in: articuloIds } },
    select: { id: true, kgNetoEnvase: true },
  })
  const pesoPorArticulo = new Map(articulos.map((a) => [a.id, a.kgNetoEnvase]))

  let total = new Prisma.Decimal(0)
  for (const l of lineas) {
    const peso = pesoPorArticulo.get(l.articuloId)
    if (peso == null || peso.lte(0)) {
      throw new ValidationError(
        `No se puede calcular la cuota en Kilo: el artículo de una línea no tiene kg neto de envase cargado (id ${l.articuloId})`,
      )
    }
    total = total.plus(peso.mul(l.cajas ?? 0))
  }
  return total
}

// Las cuotas de pago no se cargan manualmente: se copian desde la plantilla
// de la Condición de Pago seleccionada (snapshot, no referencia viva — si la
// plantilla cambia después no afecta OCs ya creadas). Para la cuota con
// tipoValor MONTO_UNITARIO, además se resuelve y congela `montoCalculado`
// (valorUnitario × cantidad real de cajas/kilos de las líneas de esta OC).
async function cuotasDesdeCondicionPago(
  tx: Tx,
  condicionPagoId: number | null | undefined,
  lineas: { cajas: number | null; cantidadKilos: Prisma.Decimal | null; articuloId: number }[],
  modalidad: 'CAJAS' | 'GRANEL',
) {
  if (!condicionPagoId) return []
  const condicionPago = await tx.condicionPago.findFirst({
    where: { id: condicionPagoId, eliminadoEn: null },
    include: { cuotas: true },
  })
  if (!condicionPago) return []

  return Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    condicionPago.cuotas.map(async (c: any) => {
      const montoCalculado =
        c.tipoValor === 'MONTO_UNITARIO'
          ? (c.valorUnitario as Prisma.Decimal).mul(await calcularCantidadReal(tx, lineas, c.unidadId, modalidad))
          : null
      return {
        fechaReferencia: c.fechaReferencia,
        plazoDias: c.plazoDias,
        tipoValor: c.tipoValor,
        porcentaje: c.porcentaje,
        valorUnitario: c.valorUnitario,
        monedaId: c.monedaId,
        unidadId: c.unidadId,
        montoCalculado,
        descripcion: c.descripcion,
      }
    }),
  )
}

// Recalcula `montoCalculado` de las cuotas MONTO_UNITARIO ya guardadas contra
// las líneas actuales — se llama cada vez que se agrega/edita/elimina una
// línea de la OC, para que el monto no quede congelado contra cantidades
// viejas (FAS-PMQ-R1-004). Consulta las líneas vigentes internamente (mismo
// patrón que notas-venta.repository.ts) en vez de recibirlas del caller.
async function recalcularCuotasMontoUnitario(tx: Tx, ordenCompraId: number) {
  const cuotasMontoUnitario = await tx.ordenCompraCuotaPago.findMany({
    where: { ordenCompraId, tipoValor: 'MONTO_UNITARIO' },
  })
  if (cuotasMontoUnitario.length === 0) return

  const orden = await tx.ordenCompra.findUniqueOrThrow({ where: { id: ordenCompraId }, select: { modalidad: true } })
  const lineas = await tx.ordenCompraLinea.findMany({
    where: { ordenCompraId },
    select: { cajas: true, cantidadKilos: true, articuloId: true },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const cuota of cuotasMontoUnitario as any[]) {
    const montoCalculado = (cuota.valorUnitario as Prisma.Decimal).mul(
      await calcularCantidadReal(tx, lineas, cuota.unidadId, orden.modalidad),
    )
    await tx.ordenCompraCuotaPago.update({ where: { id: cuota.id }, data: { montoCalculado } })
  }
}

export async function createOrdenCompra(data: OrdenCompraCreateInput, creadoPor: string) {
  const anio = (data.fecha ?? new Date()).getFullYear()
  const prefijo = `OC-${anio}-`
  const { solicitudInspeccionIds, ...resto } = data

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_ORDEN_COMPRA}::int, ${anio}::int)`

    const total = await tx.ordenCompra.count({ where: { numero: { startsWith: prefijo } } })
    const numero = `${prefijo}${String(total + 1).padStart(4, '0')}`
    // Sin líneas al crear (se agregan de a una después, ver addLinea) —
    // mismo patrón que createNotaVenta.
    const cuotasPago = await cuotasDesdeCondicionPago(tx, data.condicionPagoId, [], data.modalidad ?? 'CAJAS')

    return tx.ordenCompra.create({
      data: {
        // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe
        // este valor con la empresa activa del contexto — se declara aquí
        // solo para satisfacer el tipo requerido por Prisma.
        empresaId: getEmpresaIdActual()!,
        ...resto,
        numero,
        creadoPor,
        cuotasPago: { create: cuotasPago },
        // N:M (2026-08-22, Etapa 2) — el @@unique(empresaId, solicitudInspeccionId)
        // de la tabla puente es la última defensa contra doble vínculo; el
        // service ya valida antes con un mensaje amigable.
        solicitudes: {
          create: (solicitudInspeccionIds ?? []).map((solicitudInspeccionId) => ({ solicitudInspeccionId, creadoPor })),
        },
      },
      include: includeDetalle,
    })
  })
}

export async function updateOrdenCompra(id: number, data: OrdenCompraUpdateInput, actualizadoPor: string) {
  const { solicitudInspeccionIds, ...resto } = data
  return prisma.$transaction(async (tx) => {
    await lockYVerificarEditable(tx, id)
    // Autoridad bajo lock (lee estado/modalidad/condición/notaVenta una sola vez):
    // el service ya hizo pre-checks amigables no bloqueados, pero la verdad para
    // mutar sale de acá, serializada contra addLinea/updateLinea por el mismo
    // LOCK_NAMESPACE_ORDEN_COMPRA_PROCESO.
    const actual = await tx.ordenCompra.findUniqueOrThrow({
      where: { id },
      select: { notaVentaId: true, condicionPagoId: true, modalidad: true, estado: true },
    })
    const cambiaModalidad = data.modalidad !== undefined && data.modalidad !== actual.modalidad
    const cambiaCondicion = data.condicionPagoId !== undefined && data.condicionPagoId !== actual.condicionPagoId

    // QA-APL-001: cambiar la modalidad (Cajas/Granel) solo en BORRADOR y sin
    // líneas — revalidado BAJO LOCK para que una línea agregada entre el
    // pre-check del service y este punto no deje una OC GRANEL con líneas CAJAS.
    if (cambiaModalidad) {
      if (actual.estado !== 'BORRADOR') {
        throw new ValidationError('La modalidad (Cajas/Granel) solo puede cambiarse mientras la Orden de Compra está en Borrador')
      }
      const lineasCount = await tx.ordenCompraLinea.count({ where: { ordenCompraId: id } })
      if (lineasCount > 0) {
        throw new ValidationError('No se puede cambiar la modalidad de una Orden de Compra que ya tiene líneas — elimínelas primero')
      }
    }

    // FAS-OCNV-001 (QA ronda 1): no cambiar el Cierre Comercial con líneas tomadas.
    if (data.notaVentaId !== undefined && data.notaVentaId !== actual.notaVentaId) {
      const lineasDeCierre = await tx.ordenCompraLinea.count({ where: { ordenCompraId: id, notaVentaDetalleId: { not: null } } })
      if (lineasDeCierre > 0) {
        throw new ValidationError(
          'No se puede cambiar el Cierre Comercial de la Orden de Compra: tiene líneas tomadas de un Cierre Comercial — elimínelas primero',
        )
      }
    }

    // QA-APL-002: regenerar/validar las cuotas cuando cambie la condición de pago
    // O la modalidad, usando SIEMPRE los valores EFECTIVOS finales. Así pasar a
    // GRANEL revalida las cuotas MONTO_UNITARIO contra la nueva modalidad (deben
    // estar en KG) aunque no se toque la condición. El snapshot es inmutable: solo
    // se regenera si algo relevante cambió (reenviar la condición sin cambios no
    // reescribe las cuotas).
    if (cambiaCondicion || cambiaModalidad) {
      const condicionObjetivo = data.condicionPagoId ?? actual.condicionPagoId
      const modalidadObjetivo = data.modalidad ?? actual.modalidad
      const lineasActuales = await tx.ordenCompraLinea.findMany({ where: { ordenCompraId: id } })
      const cuotasPago = await cuotasDesdeCondicionPago(tx, condicionObjetivo, lineasActuales, modalidadObjetivo)
      await tx.ordenCompraCuotaPago.deleteMany({ where: { ordenCompraId: id } })
      await tx.ordenCompraCuotaPago.createMany({ data: cuotasPago.map((c) => ({ ordenCompraId: id, ...c })) })
    }
    return tx.ordenCompra.update({
      where: { id },
      data: {
        ...resto,
        actualizadoPor,
        // N:M (2026-08-22, Etapa 2): si viene, reemplaza el conjunto completo
        // (mismo patrón que calibres en updateLinea) — si no viene, se
        // conservan los vínculos existentes.
        ...(solicitudInspeccionIds
          ? {
              solicitudes: {
                deleteMany: {},
                create: solicitudInspeccionIds.map((solicitudInspeccionId) => ({ solicitudInspeccionId, creadoPor: actualizadoPor })),
              },
            }
          : {}),
      },
      include: includeDetalle,
    })
  })
}

const lineaInclude = {
  especie: { select: mantenedorSelect },
  variedad: { select: mantenedorSelect },
  categoria: { select: mantenedorSelect },
  articulo: { select: { id: true, codigo: true, descripcion: true, etiqueta: true, kgNetoEnvase: true, kgBrutoEnvase: true } },
  etiqueta: { select: mantenedorSelect },
  calibres: { select: { calibre: { select: mantenedorSelect } } },
  tipoPallet: { select: mantenedorSelect },
}

// Resolución + validación autoritativa de una línea tomada del Cierre
// Comercial (FAS-OCNV-001/FAS-OCNV-004, QA ronda 2/arbitraje) — TODO lo que
// antes resolvía el service con una lectura no bloqueada (pertenencia al
// Cierre de la OC, categoría definida, calibres subconjunto, disponible) se
// vuelve a resolver acá, DESPUÉS de tomar el lock de la OC
// (lockYVerificarEditable, ya hecho por el caller) y el de
// LOCK_NAMESPACE_NOTA_VENTA_DETALLE (acá) — así una línea no puede insertarse
// contra un Cierre que la OC dejó de tener, ni con atributos
// (especie/variedad/categoría/artículo/tipoPallet) que Ventas alcanzó a
// cambiar en el hueco entre el pre-check amigable del service y este punto.
// El pre-check del service (resolverLineaDesdeCierre) queda solo como mensaje
// de UX rápido — la verdad para insertar/actualizar sale exclusivamente de
// acá. `excluirLineaId` se usa en updateLinea para no contarse a sí misma en
// la suma de comprometido.
async function resolverLineaCierreBajoLock(
  tx: Prisma.TransactionClient,
  notaVentaIdOrden: number | null,
  notaVentaDetalleId: number,
  calibreIdsSolicitados: number[],
  cajasSolicitadas: number,
  excluirLineaId?: number,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_NOTA_VENTA_DETALLE}::int, ${notaVentaDetalleId}::int)`
  const detalle = await tx.notaVentaDetalle.findUnique({ where: { id: notaVentaDetalleId }, select: notaVentaDetalleSelect })
  if (!detalle) throw new ValidationError('La línea de Cierre Comercial seleccionada ya no existe')
  if (notaVentaIdOrden == null || detalle.notaVentaId !== notaVentaIdOrden) {
    throw new ValidationError('La línea de Cierre Comercial seleccionada ya no pertenece al Cierre Comercial de esta Orden de Compra')
  }
  if (detalle.categoriaId == null) {
    throw new ValidationError('La línea del Cierre Comercial no tiene categoría definida — no se puede usar para una Orden de Compra')
  }
  const calibresPermitidos = new Set(detalle.calibres.map((c) => c.calibreId))
  if (calibreIdsSolicitados.some((id) => !calibresPermitidos.has(id))) {
    throw new ValidationError('Uno o más calibres no están permitidos por la línea del Cierre Comercial')
  }
  const comprometidoAgg = await tx.ordenCompraLinea.aggregate({
    where: {
      notaVentaDetalleId,
      ordenCompra: { eliminadoEn: null },
      ...(excluirLineaId != null ? { id: { not: excluirLineaId } } : {}),
    },
    _sum: { cajas: true },
  })
  const disponible = detalle.cajas - (comprometidoAgg._sum.cajas ?? 0)
  if (cajasSolicitadas > disponible) {
    throw new ValidationError(
      `La línea de Cierre Comercial solo tiene ${disponible} caja(s) disponible(s) — otra Orden de Compra tomó cajas mientras tanto`,
    )
  }
  return {
    especieId: detalle.especieId,
    variedadId: detalle.variedadId,
    categoriaId: detalle.categoriaId,
    articuloId: detalle.articuloId,
    tipoPalletId: detalle.tipoPalletId,
  }
}

// Resuelve/valida la etiqueta de la línea contra el set permitido del artículo
// FINAL (el resuelto bajo lock), para que una línea de Cierre cuyo artículo
// cambió entre el pre-check y la transacción no quede con una etiqueta ajena a
// su artículo (FAS-EOCSP-004). Fija → autocompleta; dinámica sin elección → error.
async function resolverEtiquetaBajoLock(tx: Prisma.TransactionClient, articuloId: number, etiquetaId: number | null): Promise<number> {
  const art = await tx.articulo.findUnique({
    where: { id: articuloId },
    select: { descripcion: true, etiquetaId: true, etiquetasAdicionales: { select: { etiquetaId: true } } },
  })
  const permitidas = new Set<number>()
  if (art?.etiquetaId != null) permitidas.add(art.etiquetaId)
  for (const a of art?.etiquetasAdicionales ?? []) permitidas.add(a.etiquetaId)
  const nombre = art?.descripcion ?? `#${articuloId}`
  if (permitidas.size === 0) throw new ValidationError(`El artículo "${nombre}" no tiene etiqueta configurada`)
  if (etiquetaId != null) {
    if (!permitidas.has(etiquetaId)) {
      throw new ValidationError(`La etiqueta seleccionada no está permitida para el artículo "${nombre}" (pudo cambiar el artículo del Cierre Comercial) — recarga y reintenta`)
    }
    return etiquetaId
  }
  if (permitidas.size === 1) return [...permitidas][0]
  throw new ValidationError(`El artículo "${nombre}" tiene etiqueta dinámica — selecciona la etiqueta`)
}

export async function addLinea(ordenCompraId: number, data: OrdenCompraLineaCreateInput, modalidadEsperada: 'CAJAS' | 'GRANEL') {
  const { calibreIds, notaVentaDetalleId, ...resto } = data
  return prisma.$transaction(async (tx) => {
    await lockYVerificarEditable(tx, ordenCompraId)
    const orden = await tx.ordenCompra.findUniqueOrThrow({ where: { id: ordenCompraId }, select: { notaVentaId: true, modalidad: true } })
    // QA-APL-001 (árbitro ronda 2): compare-and-swap de modalidad BAJO LOCK. El
    // service validó y normalizó la línea con la modalidad leída antes de la
    // transacción; si cambió entre medio (un PATCH que pasó la OC a la otra
    // modalidad tomó el lock primero), la línea normalizada ya no corresponde —
    // se rechaza en vez de insertar una línea con el contrato de la otra modalidad.
    if (orden.modalidad !== modalidadEsperada) {
      throw new ValidationError('La modalidad de la Orden de Compra cambió mientras agregabas la línea. Recarga e inténtalo de nuevo.')
    }
    // Defensa bajo lock: una OC granel nunca toma líneas de un Cierre Comercial.
    if (orden.modalidad === 'GRANEL' && notaVentaDetalleId != null) {
      throw new ValidationError('Una Orden de Compra en modalidad granel no puede tomar líneas de un Cierre Comercial')
    }
    // camposCierre pisa cualquier especie/variedad/categoría/artículo/
    // tipoPallet que el caller haya resuelto antes del lock — la fuente de
    // verdad es exclusivamente la lectura fresca de acá (FAS-OCNV-001/004).
    // Solo aplica en CAJAS (el Cierre Comercial es de fruta embalada; el
    // service bloquea líneas de Cierre en granel).
    let camposCierre: Partial<typeof resto> = {}
    if (notaVentaDetalleId != null) {
      camposCierre = await resolverLineaCierreBajoLock(tx, orden.notaVentaId, notaVentaDetalleId, calibreIds, resto.cajas ?? 0)
    }
    // Etiqueta: solo en CAJAS. En GRANEL el artículo no lleva etiqueta (FAS-EOCSP-004
    // re-resuelve la etiqueta contra el artículo FINAL bajo lock solo para cajas).
    const etiquetaFinal = orden.modalidad === 'GRANEL'
      ? null
      : await resolverEtiquetaBajoLock(tx, camposCierre.articuloId ?? resto.articuloId, resto.etiquetaId ?? null)
    const linea = await tx.ordenCompraLinea.create({
      data: {
        ...resto,
        ...camposCierre,
        etiquetaId: etiquetaFinal,
        ordenCompraId,
        notaVentaDetalleId: notaVentaDetalleId ?? null,
        calibres: { create: calibreIds.map((calibreId) => ({ calibreId })) },
      },
      include: lineaInclude,
    })
    await recalcularCuotasMontoUnitario(tx, ordenCompraId)
    return linea
  })
}

export async function getLineaById(id: number) {
  return prisma.ordenCompraLinea.findUnique({
    where: { id },
    select: { id: true, ordenCompraId: true, notaVentaDetalleId: true },
  })
}

export async function updateLinea(ordenCompraId: number, id: number, data: OrdenCompraLineaUpdateInput, modalidadEsperada: 'CAJAS' | 'GRANEL') {
  const { calibreIds, ...resto } = data
  return prisma.$transaction(async (tx) => {
    await lockYVerificarEditable(tx, ordenCompraId)
    // notaVentaDetalleId no viene en el UpdateInput (inmutable post-creación,
    // ver ordenes-compra.types.ts) — se lee la línea vigente para saber si
    // corresponde revalidar el disponible.
    const lineaActual = await tx.ordenCompraLinea.findUnique({ where: { id }, select: { notaVentaDetalleId: true } })
    const orden = await tx.ordenCompra.findUniqueOrThrow({ where: { id: ordenCompraId }, select: { notaVentaId: true, modalidad: true } })
    // QA-APL-001 (árbitro ronda 2): compare-and-swap de modalidad bajo lock —
    // la línea se normalizó con la modalidad leída por el service antes de la tx.
    if (orden.modalidad !== modalidadEsperada) {
      throw new ValidationError('La modalidad de la Orden de Compra cambió mientras editabas la línea. Recarga e inténtalo de nuevo.')
    }
    let camposCierre: Partial<typeof resto> = {}
    if (lineaActual?.notaVentaDetalleId != null) {
      camposCierre = await resolverLineaCierreBajoLock(tx, orden.notaVentaId, lineaActual.notaVentaDetalleId, calibreIds, resto.cajas ?? 0, id)
    }
    // Etiqueta: solo en CAJAS (ver addLinea). En GRANEL queda null.
    const etiquetaFinal = orden.modalidad === 'GRANEL'
      ? null
      : await resolverEtiquetaBajoLock(tx, camposCierre.articuloId ?? resto.articuloId, resto.etiquetaId ?? null)
    const linea = await tx.ordenCompraLinea.update({
      where: { id },
      data: {
        ...resto,
        ...camposCierre,
        etiquetaId: etiquetaFinal,
        calibres: { deleteMany: {}, create: calibreIds.map((calibreId) => ({ calibreId })) },
      },
      include: lineaInclude,
    })
    await recalcularCuotasMontoUnitario(tx, linea.ordenCompraId)
    return linea
  })
}

export async function removeLinea(id: number, ordenCompraId: number) {
  return prisma.$transaction(async (tx) => {
    await lockYVerificarEditable(tx, ordenCompraId)
    await tx.ordenCompraLinea.delete({ where: { id } })
    await recalcularCuotasMontoUnitario(tx, ordenCompraId)
  })
}

// Emisión del documento oficial = transición BORRADOR -> EMITIDA (2026-10-05).
// Idempotente: el updateMany con estado=BORRADOR en el where actúa como
// compare-and-swap — una OC ya EMITIDA o RECEPCIONADA no se toca (count: 0),
// y dos emisiones concurrentes del mismo documento no la "re-emiten". La
// dispara documentos.service.emitirDocumento tras congelar el PDF.
export async function marcarOrdenCompraEmitida(id: number, actualizadoPor: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    // QA-APL-001 (árbitro ronda 2): toma el mismo advisory lock por OC que
    // updateOrdenCompra/addLinea/updateLinea. Serializa la emisión contra un
    // cambio de modalidad en curso — sin esto, una emisión podía completarse
    // entre la lectura "estado = BORRADOR" del PATCH de modalidad y su escritura,
    // dejando que el cambio de modalidad aterrizara sobre una OC ya EMITIDA. El
    // updateMany con estado=BORRADOR en el where sigue siendo el compare-and-swap.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_ORDEN_COMPRA_PROCESO}::int, ${id}::int)`
    const result = await tx.ordenCompra.updateMany({
      where: { id, estado: 'BORRADOR', eliminadoEn: null },
      data: { estado: 'EMITIDA', actualizadoPor },
    })
    return result.count
  })
}

export async function softDeleteOrdenCompra(id: number, eliminadoPor: string) {
  return prisma.$transaction(async (tx) => {
    await lockYVerificarEditable(tx, id)
    // Libera las Solicitudes de Inspección vinculadas (2026-08-22, decisión
    // de negocio, Christian): una OC eliminada no debe bloquear su Solicitud
    // para siempre — se borran las filas de la tabla puente (no la propia
    // Solicitud ni la OC, que sigue existiendo vía soft delete).
    await tx.ordenCompraSolicitudInspeccion.deleteMany({ where: { ordenCompraId: id } })
    return tx.ordenCompra.update({
      where: { id },
      data: { eliminadoEn: new Date(), eliminadoPor },
    })
  })
}

export async function getEntidadProductor(id: number) {
  return prisma.entidad.findFirst({
    where: { id, eliminadoEn: null, activo: true },
    select: { id: true, tipos: true },
  })
}

export async function getNotaVenta(id: number) {
  return prisma.notaVenta.findFirst({ where: { id, eliminadoEn: null }, select: { id: true } })
}

// ─── Línea de Cierre Comercial → Línea de OC (2026-08-23) ─────────────────

const notaVentaDetalleSelect = {
  id: true,
  notaVentaId: true,
  especieId: true,
  variedadId: true,
  categoriaId: true,
  articuloId: true,
  tipoPalletId: true,
  cajas: true,
  calibres: { select: { calibreId: true } },
}

export async function getNotaVentaDetalle(id: number) {
  return prisma.notaVentaDetalle.findUnique({ where: { id }, select: notaVentaDetalleSelect })
}

// Cajas ya comprometidas por OrdenCompraLinea vigentes (de OC no eliminadas)
// contra una línea del Cierre — lectura no bloqueada, para el pre-check
// "amigable" del service. La autoridad real bajo lock está en
// verificarDisponibleBajoLock (arriba, dentro de addLinea/updateLinea).
export async function getCajasComprometidas(notaVentaDetalleId: number, excluirLineaId?: number) {
  const result = await prisma.ordenCompraLinea.aggregate({
    where: {
      notaVentaDetalleId,
      ordenCompra: { eliminadoEn: null },
      ...(excluirLineaId != null ? { id: { not: excluirLineaId } } : {}),
    },
    _sum: { cajas: true },
  })
  return result._sum.cajas ?? 0
}

// Líneas del Cierre con su disponible calculado — alimenta la grilla del
// formulario de OC al elegir un Cierre Comercial. Se resuelve en 2 pasadas
// (traer líneas, agregar comprometido por línea) porque Prisma no soporta
// un groupBy anidado en una sola query contra una relación N:1 indirecta.
export async function getNotaVentaDetalleConDisponibilidad(notaVentaId: number) {
  const lineas = await prisma.notaVentaDetalle.findMany({
    where: { notaVentaId },
    include: {
      especie: { select: mantenedorSelect },
      variedad: { select: mantenedorSelect },
      categoria: { select: mantenedorSelect },
      articulo: { select: { id: true, codigo: true, descripcion: true } },
      // Etiqueta (Marca) resuelta en el Cierre: la OC la usa como valor inicial
      // al tomar esta línea (editable, 2026-10-18).
      etiqueta: { select: mantenedorSelect },
      tipoPallet: { select: mantenedorSelect },
      calibres: { select: { calibre: { select: mantenedorSelect } } },
    },
    orderBy: { id: 'asc' },
  })
  if (lineas.length === 0) return []

  const comprometidos = await prisma.ordenCompraLinea.groupBy({
    by: ['notaVentaDetalleId'],
    where: { notaVentaDetalleId: { in: lineas.map((l) => l.id) }, ordenCompra: { eliminadoEn: null } },
    _sum: { cajas: true },
  })
  const comprometidoPorLinea = new Map(comprometidos.map((c) => [c.notaVentaDetalleId, c._sum.cajas ?? 0]))

  return lineas.map((l) => {
    const cajasComprometidas = comprometidoPorLinea.get(l.id) ?? 0
    return { ...l, cajasComprometidas, cajasDisponibles: l.cajas - cajasComprometidas }
  })
}

// La OC exige al menos una Inspección de Compra Aprobada del mismo productor
// entre TODAS las vinculadas (compras.md §4.2, N:M 2026-08-22) — se valida
// completo desde el service; este helper solo trae los datos necesarios.
export async function getSolicitudesInspeccion(ids: number[]) {
  return prisma.solicitudInspeccion.findMany({
    where: { id: { in: ids }, eliminadoEn: null },
    select: { id: true, estado: true, entidadProductorId: true },
  })
}

// Solicitudes de la lista que ya están vinculadas a OTRA Orden de Compra
// (excluyendo la propia, en una edición) — dato para un mensaje de error
// amigable antes de chocar con el @@unique de la tabla puente.
export async function getSolicitudesYaVinculadas(ids: number[], excluirOrdenCompraId?: number) {
  return prisma.ordenCompraSolicitudInspeccion.findMany({
    where: {
      solicitudInspeccionId: { in: ids },
      ...(excluirOrdenCompraId != null ? { ordenCompraId: { not: excluirOrdenCompraId } } : {}),
    },
    select: { solicitudInspeccionId: true, ordenCompraId: true },
  })
}

export async function getMoneda(id: number) {
  return prisma.moneda.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getFormaPago(id: number) {
  return prisma.formaPago.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getMercado(id: number) {
  return prisma.mercado.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

// Valida que la Cláusula de Venta (Incoterm) exista y esté vigente (2026-09-30:
// mantenedor propio ClausulaVenta, antes catálogo genérico Parametro).
export async function getClausulaVenta(id: number) {
  return prisma.clausulaVenta.findFirst({
    where: { id, eliminadoEn: null, bloqueado: false },
    select: { id: true },
  })
}

export async function getCondicionPago(id: number) {
  return prisma.condicionPago.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getUsuarioResponsable(id: string) {
  return prisma.usuario.findFirst({
    where: { id, eliminadoEn: null, esResponsableVenta: true },
    select: { id: true },
  })
}

export async function getEspecie(id: number) {
  return prisma.especie.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getVariedad(id: number) {
  return prisma.variedad.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true, especieId: true } })
}

export async function getCategoria(id: number) {
  return prisma.categoria.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true, especieId: true } })
}

export async function getCalibresActivos(ids: number[]) {
  return prisma.calibre.findMany({
    where: { id: { in: ids }, eliminadoEn: null, bloqueado: false },
    select: { id: true, especieId: true },
  })
}

export async function getArticuloTipo(id: number) {
  return prisma.articulo.findUnique({
    where: { id },
    select: {
      id: true,
      tipo: true,
      activo: true,
      descripcion: true,
      // Set de etiquetas permitido = principal ∪ adicionales (2026-10-15).
      etiquetaId: true,
      etiquetasAdicionales: { select: { etiquetaId: true } },
    },
  })
}

export async function getTipoPallet(id: number) {
  return prisma.tipoPallet.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}
