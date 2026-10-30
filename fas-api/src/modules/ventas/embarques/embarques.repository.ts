import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { BusinessError, ValidationError } from '../../../shared/errors.js'
import {
  LOCK_NAMESPACE_EMBARQUE_DESPACHO,
  LOCK_NAMESPACE_EMBARQUE_SOLICITUD_RESERVA,
  LOCK_NAMESPACE_EMBARQUE_CORRELATIVO,
  LOCK_NAMESPACE_DOCUMENTO_DTE_EMISION,
} from '../../../shared/advisory-locks.js'
import { palletCalzaConDetalleNV } from './embarques.comparacion.js'
import type { DatoPalletReconciliado } from './embarques.packing-list.motor.js'
import type { DatosReservaManualInput, DatosReservaBaseInput, DatosInstructivoInput, InstructivoHijoUpdateInput, DatosContenedorInput } from './embarques.types.js'

// 502: la integración externa (no FAS) fue la que falló — distingue este
// caso de un 422 de validación normal para que el frontend sepa mostrar el
// diálogo "¿Generar Embarque sin reserva?" en vez de un toast genérico.
// Vive acá (no en el service) porque se lanza DESDE dentro de la transacción
// de generarEmbarqueTransaccional/solicitarReservaTransaccional — mismo
// motivo que StockInsuficienteError vive en movimientos.repository.ts.
export class IntegracionAglFallidaError extends BusinessError {
  constructor(message: string) {
    super('AGL_INTEGRACION_FALLIDA', message, 502)
  }
}

// Resultado de intentar la integración con AGL360 (implementado en el
// service, que sabe armar el payload de negocio) — la transacción del
// repositorio decide qué persistir según esto, pero no sabe llamar a AGL360.
export interface ResultadoIntentoReserva {
  ok: boolean
  referenciaFas?: string
  payloadEnviado?: unknown
  payloadRespuesta?: unknown
  error?: string
}

const notaVentaRefSelect = { id: true, folio: true }
const mantenedorSelect = { id: true, codigo: true, descripcion: true }
const entidadSelect = { id: true, codigo: true, descripcion: true }

// Metadata de la reconciliación de Packing List (compras.md §9.3) — sin el
// blob del Excel, mismo criterio que RecepcionAdjunto/RecepcionAdjuntoContenido.
const packingListSelect = {
  id: true,
  templateCargaId: true,
  nombreArchivo: true,
  mime: true,
  tamano: true,
  estado: true,
  discrepancias: true,
  numerosPallet: true,
  termografos: true,
  cargadoEn: true,
  cargadoPor: true,
} satisfies Prisma.EmbarquePackingListSelect

// Detalle de origen de cada pallet — de qué OC (modo COMPRA) o de qué
// Instructivo(s) de Embalaje (modo PROCESO) viene, para que el paso
// "Seleccionar Pallets" del Embarque (y el detalle ya reservado) siempre
// pueda mostrar la trazabilidad completa (2026-09-02).
const palletInclude = {
  productor: { select: entidadSelect },
  // Nota de Calidad/Condición (compras.md §4.8) — a nivel de Pallet, para la
  // columna "Calificación" (código+código, ej. "A1") en Seleccionar Pallets.
  notaCalidad: { select: mantenedorSelect },
  notaCondicion: { select: mantenedorSelect },
  recepcion: {
    select: {
      planta: { select: entidadSelect },
      ordenCompra: { select: { id: true, numero: true } },
      instructivos: { select: { instructivo: { select: { id: true, numero: true } } } },
    },
  },
  lineas: {
    select: {
      especieId: true,
      especie: { select: mantenedorSelect },
      variedadId: true,
      variedad: { select: mantenedorSelect },
      categoriaId: true,
      categoria: { select: mantenedorSelect },
      articuloId: true,
      articulo: { select: { ...mantenedorSelect, kgNetoEnvase: true } },
      calibreId: true,
      calibre: { select: mantenedorSelect },
      cajas: true,
      // Antigüedad del pallet en Seleccionar Pallets = la mayor entre sus
      // líneas (compras.md §4.10) — null en PalletLinea históricas.
      fechaEmbalaje: true,
    },
  },
} satisfies Prisma.PalletInclude

// Select ampliado del listado (2026-09-30): Cliente/Mercado/Puerto destino —
// solo para esta pantalla, no se agranda `notaVentaRefSelect` (compartido por
// el resto del módulo) para no abultar el resto de las respuestas.
const notaVentaListaSelect = {
  id: true,
  folio: true,
  tipoVenta: true,
  cliente: { select: { id: true, codigo: true, descripcion: true, razonSocial: true } },
  mercado: { select: { id: true, codigo: true, descripcion: true } },
  puertoDestino: { select: { id: true, codigo: true, descripcion: true } },
} satisfies Prisma.NotaVentaSelect

// Estado combinado (2026-09-30, ver embarques.schema.ts ESTADOS_EMBARQUE_LISTADO):
// where-clause por valor filtrable — "efectivamente despachado" siempre pisa
// al estado de reserva, igual que el resto del sistema (ver
// requireEmbarqueDespachado en cobranza/facturación).
function whereEstadoListado(estado?: string): Prisma.EmbarqueWhereInput {
  switch (estado) {
    case 'DESPACHADO':
      return { despachadoEn: { not: null }, despachoAnuladoEn: null }
    case 'DESPACHO_ANULADO':
      return { despachadoEn: { not: null }, despachoAnuladoEn: { not: null } }
    case 'PENDIENTE':
    case 'SOLICITADA':
    case 'CONFIRMADA':
      return { estadoReserva: estado, despachadoEn: null }
    default:
      return {}
  }
}

// Orden explícito pedido por el usuario (header clicable) — mismo patrón que
// config.repository.ts:resolveOrderBy. Solo columnas con un orderBy simple o
// de relación a-uno tienen sentido acá; Estado es combinado (no se ordena).
function resolveOrderByEmbarque(sort?: string): Prisma.EmbarqueOrderByWithRelationInput[] {
  if (sort) {
    try {
      const arr = JSON.parse(sort) as Array<{ id: string; desc: boolean }>
      const first = Array.isArray(arr) ? arr[0] : null
      if (first?.id) {
        const dir = first.desc ? 'desc' : 'asc'
        switch (first.id) {
          case 'numeroInstructivo': return [{ numeroInstructivo: dir }]
          case 'creadoEn': return [{ creadoEn: dir }]
          case 'cliente': return [{ notaVenta: { cliente: { descripcion: dir } } }]
          case 'mercado': return [{ notaVenta: { mercado: { descripcion: dir } } }]
          case 'puertoDestino': return [{ notaVenta: { puertoDestino: { descripcion: dir } } }]
        }
      }
    } catch {
      /* sort inválido: orden por defecto */
    }
  }
  return [{ creadoEn: 'desc' }]
}

export async function listEmbarques(
  page: number,
  limit: number,
  notaVentaId?: number,
  estado?: string,
  sort?: string,
) {
  const where: Prisma.EmbarqueWhereInput = {
    eliminadoEn: null,
    ...(notaVentaId ? { notaVentaId } : {}),
    ...whereEstadoListado(estado),
  }
  const [data, total] = await Promise.all([
    prisma.embarque.findMany({
      where,
      include: {
        notaVenta: { select: notaVentaListaSelect },
        // reclamos activos (soft-delete excluido) — solo para el flag Sí/No de la
        // columna "Reclamo" del listado.
        _count: { select: { pallets: true, reclamos: { where: { eliminadoEn: null } } } },
      },
      orderBy: resolveOrderByEmbarque(sort),
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.embarque.count({ where }),
  ])

  // Guía de Despacho propia (DTE 52) por fila (2026-10-12): una sola consulta
  // para toda la página en vez de N llamadas a obtenerGuiaDespacho. Expone si
  // hay PDF disponible (libredteCodigoTemporal presente = borrador o timbrada)
  // y el folio si está timbrada. La guía externa ya viaja en el escalar
  // guiaExternaNumero del propio Embarque.
  const guias = data.length
    ? await prisma.documentoDte.findMany({
        where: { origenTipo: 'embarque', origenId: { in: data.map((e) => e.id) }, tipoDte: 52 },
        select: { origenId: true, estado: true, folio: true, libredteCodigoTemporal: true },
      })
    : []
  const guiaPorEmbarque = new Map(guias.map((g) => [g.origenId, g]))
  const dataConGuia = data.map((e) => {
    const g = guiaPorEmbarque.get(e.id)
    return {
      ...e,
      guiaDespacho: {
        pdfDisponible: !!g?.libredteCodigoTemporal,
        estado: g?.estado ?? null,
        folio: g?.folio ?? null,
      },
    }
  })
  return { data: dataConGuia, total }
}

// `instructivosHijos`/`packingLists` filtran `eliminadoEn: null` (soft
// delete, 2026-09-22, "Anular Despacho") — la respuesta expone `packingList`
// (singular, `packingLists[0] ?? null`) para no tocar el contrato del
// frontend, que sigue viendo a lo más una reconciliación vigente.
export async function getEmbarqueById(id: number) {
  const embarque = await prisma.embarque.findFirst({
    where: { id, eliminadoEn: null },
    include: {
      // Detalle enriquecido (2026-09-28): datos de la NV derivados para la
      // "información base" de la reserva (Tipo de Embarque, Puerto Destino,
      // Consignatario, Especies) — el listado sigue usando notaVentaRefSelect.
      notaVenta: {
        select: {
          id: true,
          folio: true,
          tipoEmbarque: { select: mantenedorSelect },
          puertoDestino: { select: mantenedorSelect },
          consignatario: { select: { id: true, razonSocial: true } },
          detalles: { select: { especie: { select: mantenedorSelect } } },
        },
      },
      pallets: { include: palletInclude, orderBy: { id: 'asc' as const } },
      solicitudReserva: true,
      gestorLogistico: { select: entidadSelect },
      // Instructivo de Embarque (2026-09-21, ventas.md R11).
      puertoZarpe: { select: mantenedorSelect },
      agenteAduana: { select: entidadSelect },
      embarcador: { select: entidadSelect },
      naviera: { select: entidadSelect },
      tipoBl: { select: mantenedorSelect },
      instructivosHijos: {
        where: { eliminadoEn: null },
        include: { planta: { select: entidadSelect } },
        orderBy: { secuencia: 'asc' as const },
      },
      // Rangos de stacking (ventas.md R11, 2026-09-22) — N por Embarque.
      stackingRangos: { orderBy: { orden: 'asc' as const } },
      // Reconciliación de Packing List (compras.md §9.3) — sin `contenido`
      // (el blob se descarga aparte, ver getPackingListContenido).
      packingLists: { where: { eliminadoEn: null }, select: packingListSelect, orderBy: { cargadoEn: 'asc' } },
    },
  })
  if (!embarque) return null
  // Packing parcializado (2026-09-28): se expone la LISTA de archivos activos
  // + un resumen de cobertura (cuántos pallets cubren vs. reservados). Se
  // mantiene `packingList` (el primero) por compatibilidad con lecturas viejas.
  const { packingLists, ...resto } = embarque
  const totalReservados = embarque.pallets.length
  const numerosReservados = new Set(embarque.pallets.map((p) => p.numeroPallet))
  const cubiertos = new Set<string>()
  let hayDiscrepancia = false
  let haySobrante = false // pallet cubierto que ya no está reservado (FAS-DEV-QA-R2-007)
  for (const pl of packingLists) {
    if (pl.estado !== 'OK') hayDiscrepancia = true
    for (const n of (pl.numerosPallet as string[]) ?? []) {
      if (numerosReservados.has(n)) cubiertos.add(n)
      else haySobrante = true
    }
  }
  const packingListCobertura = {
    archivos: packingLists.length,
    cubiertos: cubiertos.size,
    totalReservados,
    completo: totalReservados > 0 && cubiertos.size === totalReservados && !hayDiscrepancia && !haySobrante,
    hayDiscrepancia: hayDiscrepancia || haySobrante,
  }
  return { ...resto, packingLists, packingList: packingLists[0] ?? null, packingListCobertura }
}

// Detalle de la NV para el motor de comparación (§7 equivalente de
// Recepción, ver embarques.comparacion.ts) — mismo criterio que
// getOrdenCompraConLineas en recepciones.repository.ts.
export async function getNotaVentaConDetalle(id: number) {
  return prisma.notaVenta.findFirst({
    where: { id, eliminadoEn: null },
    include: {
      detalles: { include: { calibres: { select: { calibreId: true } } } },
      // Calidades permitidas (pares): restringen qué pallets se pueden reservar.
      calidadesPermitidas: { select: { notaCalidadId: true, notaCondicionId: true } },
    },
  })
}

// Pallets sin reservar (embarqueId null) que calzan con el detalle de la NV
// de este Embarque — candidatos para el paso "Seleccionar Pallets". El match
// es solo de catálogo (embarques.comparacion.ts), sin tope de cantidad.
export async function getPalletsDisponibles(
  detalleNV: NonNullable<Awaited<ReturnType<typeof getNotaVentaConDetalle>>>['detalles'],
  // Calidades permitidas (pares) del Cierre: si hay, solo se ofrecen pallets cuya
  // combinación (notaCalidad, notaCondicion) esté admitida. Vacío = sin restricción.
  calidadesPermitidas: { notaCalidadId: number; notaCondicionId: number }[] = [],
) {
  // 2026-09-28 (decisión de negocio Christian): se muestran TODOS los pallets
  // sin reservar que calzan con el detalle de la NV, calificados o no — el
  // frontend deshabilita la selección de los NO calificados (Nota Calidad +
  // Nota Condición + Completo). Antes se filtraba `completo: true` acá, lo que
  // ocultaba por completo los incompletos; ahora se muestran deshabilitados.
  const pallets = await prisma.pallet.findMany({
    // eliminadoEn: null (2026-10-12) — un pallet eliminado desde Edición de
    // Stock no es stock disponible y no debe poder reservarse a un Embarque.
    where: { embarqueId: null, eliminadoEn: null },
    include: palletInclude,
    orderBy: { creadoEn: 'asc' },
  })
  const calzan = pallets.filter((p) => palletCalzaConDetalleNV(p.lineas, detalleNV))
  if (calidadesPermitidas.length === 0) return calzan
  // Filtro de calidad permitida: la combinación del pallet debe estar en el set.
  const permitidos = new Set(calidadesPermitidas.map((c) => `${c.notaCalidadId}-${c.notaCondicionId}`))
  return calzan.filter((p) => p.notaCalidadId != null && p.notaCondicionId != null && permitidos.has(`${p.notaCalidadId}-${p.notaCondicionId}`))
}

// Reclamo atómico (mismo patrón que folios de Instructivo/Recepción de
// Proceso): updateMany condicionado a embarqueId=null evita que dos
// Embarques reserven el mismo pallet en una carrera concurrente. Envuelto en
// una transacción (EP-QA-001, QA ronda 1): sin esto, una reserva parcial
// (otro Embarque se llevó uno de los pallets en el medio) dejaba los demás
// ya asignados aunque el service lanzara error — el throw dentro de
// `$transaction` revierte todo el lote, no solo informa el fallo.
export async function reservarPalletsEnEmbarque(palletIds: number[], embarqueId: number) {
  await prisma.$transaction(async (tx) => {
    // FAS-IE-QA-005 (QA ronda 4): mismo lock que desvincularPallet/
    // confirmarDespacho/generarInstructivosHijos — sin esto, una generación
    // de Instructivos concurrente podía leer el conjunto de pallets justo
    // antes de que esta reserva commiteara, dejando hijos que no reflejan
    // los pallets realmente reservados.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_EMBARQUE_DESPACHO}::int, ${embarqueId}::int)`

    // Calificado (2026-09-28) = Completo + Nota Calidad + Nota Condición.
    // Defensa en profundidad / anti-carrera: aunque el frontend deshabilita
    // los no calificados, esto rechaza un pallet que se descalifique justo
    // entre el listado y la reserva (o un llamado directo a la API).
    const claim = await tx.pallet.updateMany({
      where: {
        id: { in: palletIds },
        embarqueId: null,
        eliminadoEn: null,
        completo: true,
        notaCalidadId: { not: null },
        notaCondicionId: { not: null },
      },
      data: { embarqueId },
    })
    if (claim.count !== palletIds.length) {
      throw new ValidationError('Uno o más pallets ya no están disponibles o no están calificados (requieren Nota de Calidad, Nota de Condición y estar Completos)')
    }
  })
}

type DesvincularResultado = 'OK' | 'NO_ENCONTRADO' | 'DESPACHADO'

// Desvincula un pallet, serializado contra confirmarDespacho vía el mismo
// advisory lock por embarqueId (EP-QA-002, QA ronda 2): un filtro de
// relación (`embarque: { despachadoEn: null }`) por sí solo NO bloquea la
// fila de Embarque, así que una confirmación de despacho concurrente podía
// colarse en la ventana antes de que este UPDATE commiteara. Con el lock, la
// transacción que llega segunda espera a que la primera termine y relee un
// estado ya consistente.
export async function desvincularPallet(embarqueId: number, palletId: number): Promise<DesvincularResultado> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_EMBARQUE_DESPACHO}::int, ${embarqueId}::int)`

    const embarque = await tx.embarque.findFirst({
      where: { id: embarqueId, eliminadoEn: null },
      select: { despachadoEn: true, despachoAnuladoEn: true },
    })
    if (!embarque) return 'NO_ENCONTRADO'
    // "Efectivamente despachado" (2026-09-22, Anular Despacho): un Embarque
    // despachado y luego anulado vuelve a admitir desvincular pallets.
    if (embarque.despachadoEn && !embarque.despachoAnuladoEn) return 'DESPACHADO'

    const result = await tx.pallet.updateMany({ where: { id: palletId, embarqueId }, data: { embarqueId: null } })
    return result.count > 0 ? 'OK' : 'NO_ENCONTRADO'
  })
}

// Confirma el despacho — atómico y condicionado a que no esté EFECTIVAMENTE
// despachado ya (evita una doble confirmación concurrente; un Embarque
// despachado y luego anulado SÍ puede volver a confirmarse), a que tenga al
// menos un pallet reservado (decisión de negocio, Christian: no se despacha
// vacío) y, desde 2026-09-22 (compras.md §9.3, cierra EP-QA-003), a que
// exista una reconciliación de Packing List vigente en estado OK. Mismo
// advisory lock por embarqueId que desvincularPallet (EP-QA-002, QA ronda 2)
// — serializa ambas operaciones entre sí, y ahora también contra
// guardarPackingList y anularDespacho.
export async function confirmarDespacho(embarqueId: number, despachadoPor: string) {
  // El read final (getEmbarqueById) corre DESPUÉS de que la transacción
  // commitea, no adentro — usar `prisma` en vez de `tx` dentro del callback
  // haría un read sucio contra una escritura todavía no confirmada.
  const resultado = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_EMBARQUE_DESPACHO}::int, ${embarqueId}::int)`

    const embarque = await tx.embarque.findFirst({
      where: { id: embarqueId, eliminadoEn: null },
      include: {
        pallets: { select: { numeroPallet: true } },
        packingLists: { where: { eliminadoEn: null }, select: { estado: true, numerosPallet: true } },
      },
    })
    if (!embarque) return 'NO_ENCONTRADO' as const
    const efectivamenteDespachado = !!embarque.despachadoEn && !embarque.despachoAnuladoEn
    if (efectivamenteDespachado) return 'YA_DESPACHADO' as const
    if (embarque.pallets.length === 0) return 'SIN_PALLETS' as const
    if (embarque.packingLists.length === 0) return 'SIN_PACKING_LIST' as const
    if (embarque.packingLists.some((pl) => pl.estado !== 'OK')) return 'PACKING_LIST_CON_DISCREPANCIAS' as const
    // Packing parcializado (2026-09-28): la UNIÓN de los archivos OK debe cubrir
    // EXACTAMENTE los pallets reservados (todo o nada). Se exige igualdad
    // BIDIRECCIONAL (FAS-DEV-QA-R2-007): faltantes (reservado sin cubrir) Y
    // sobrantes (cubierto que ya no está reservado — ej. se desvinculó un pallet
    // tras reconciliar) bloquean el despacho.
    const numerosReservados = new Set(embarque.pallets.map((p) => p.numeroPallet))
    const cubiertos = new Set<string>()
    for (const pl of embarque.packingLists) {
      for (const n of (pl.numerosPallet as string[]) ?? []) cubiertos.add(n)
    }
    const faltantes = [...numerosReservados].filter((n) => !cubiertos.has(n))
    const sobrantes = [...cubiertos].filter((n) => !numerosReservados.has(n))
    if (faltantes.length > 0 || sobrantes.length > 0) return 'PACKING_LIST_INCOMPLETO' as const

    // Re-despachar tras una anulación pisa la confirmación anterior (no se
    // conserva historial de ciclos completos, ver comentario en el schema).
    const claim = await tx.embarque.updateMany({
      where: { id: embarqueId, OR: [{ despachadoEn: null }, { despachoAnuladoEn: { not: null } }] },
      data: { despachadoEn: new Date(), despachadoPor, despachoAnuladoEn: null, despachoAnuladoPor: null },
    })
    return claim.count === 0 ? ('YA_DESPACHADO' as const) : ('OK' as const)
  })
  if (resultado !== 'OK') return resultado
  return getEmbarqueById(embarqueId)
}

type AnularDespachoResultado = 'OK' | 'NO_ENCONTRADO' | 'NO_DESPACHADO' | 'TIENE_RECLAMOS' | 'TIENE_GUIA_TIMBRADA' | 'TIENE_FACTURA_NACIONAL'

// "Anular Despacho" (2026-09-22, decisión de negocio Christian) — soft
// delete de la confirmación: `despachadoEn`/`despachadoPor` NO se limpian
// (quedan como registro histórico), se marca `despachoAnuladoEn`/Por. Los
// pallets NO se desvinculan (siguen reservados/seleccionados — decisión de
// negocio explícita), pero sí se descarta lo que quedó derivado de un
// despacho que ya no es válido: los `InstructivoHijo` (se regeneran con
// "Generar Instructivos" cuando corresponda) y la reconciliación de Packing
// List vigente (compras.md §9.3 — un futuro despacho debe volver a
// reconciliar). Bloqueado si el Embarque ya tiene Reclamos activos: son
// incompatibles con "esta fruta en realidad no salió" (decisión de negocio).
// Mismo advisory lock que confirmarDespacho/desvincularPallet.
export async function anularDespacho(embarqueId: number, actualizadoPor: string): Promise<AnularDespachoResultado> {
  const resultado = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_EMBARQUE_DESPACHO}::int, ${embarqueId}::int)`
    // FAS-GD-R3-004: tomar también el lock del origen DTE (mismo que usan
    // emitir/timbrar la Guía) para que la comprobación de guía timbrada y la
    // anulación sean indivisibles frente a una emisión/firma concurrente. Orden
    // estable despacho→DTE (ningún flujo toma DTE antes que despacho).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_DOCUMENTO_DTE_EMISION}::int, hashtext(${`embarque:${embarqueId}`}))`

    const embarque = await tx.embarque.findFirst({
      where: { id: embarqueId, eliminadoEn: null },
      select: { despachadoEn: true, despachoAnuladoEn: true },
    })
    if (!embarque) return 'NO_ENCONTRADO' as const
    const efectivamenteDespachado = !!embarque.despachadoEn && !embarque.despachoAnuladoEn
    if (!efectivamenteDespachado) return 'NO_DESPACHADO' as const

    const reclamosActivos = await tx.reclamo.count({ where: { embarqueId, eliminadoEn: null } })
    if (reclamosActivos > 0) return 'TIENE_RECLAMOS' as const

    // FAS-GD-R2-003: no se puede anular el despacho si la Guía de Despacho
    // (DTE 52) ya fue timbrada o está timbrándose/emitiéndose — el DTE es un
    // documento legal (o un intento en curso contra LibreDTE) que no puede
    // quedar vigente sobre un embarque "no despachado". Se consulta dentro de la
    // misma transacción, bajo el lock DTE ya tomado.
    const guiaEnProceso = await tx.documentoDte.count({
      where: { origenTipo: 'embarque', origenId: embarqueId, estado: { in: ['GENERADO', 'GENERANDO', 'EMITIENDO'] } },
    })
    if (guiaEnProceso > 0) return 'TIENE_GUIA_TIMBRADA' as const

    // VN-QA-005: no se puede anular el despacho si el Embarque tiene una Factura
    // Nacional activa (borrador/emitida) — la factura ancla la fruta despachada.
    // Hay que anular primero la factura (o emitir la Nota de Crédito si está
    // timbrada). Serializa con enviar/firmar de la factura a nivel de aplicación.
    const facturaActiva = await tx.facturaNacional.count({ where: { embarqueId, eliminadoEn: null } })
    if (facturaActiva > 0) return 'TIENE_FACTURA_NACIONAL' as const

    const claim = await tx.embarque.updateMany({
      where: { id: embarqueId, despachadoEn: { not: null }, despachoAnuladoEn: null },
      data: {
        despachoAnuladoEn: new Date(),
        despachoAnuladoPor: actualizadoPor,
        // FAS-BATCH-R1-004 (2026-10-12, decisión de negocio Christian): la Guía
        // emitida por un tercero se registra sólo sobre un despacho efectivo;
        // al anularlo se limpia (número/emisor/fecha) para que no quede
        // asociada a un ciclo posterior. La Guía propia (DTE 52) ya bloquea la
        // anulación si está timbrada/en proceso.
        guiaExternaNumero: null,
        guiaExternaEmisorId: null,
        guiaExternaFecha: null,
      },
    })
    if (claim.count === 0) return 'NO_DESPACHADO' as const

    // Soft delete (2026-09-22, decisión de negocio Christian) — se
    // conservan como historial del despacho anulado, no se borran de verdad.
    await tx.instructivoHijo.updateMany({
      where: { embarqueId, eliminadoEn: null },
      data: { eliminadoEn: new Date(), eliminadoPor: actualizadoPor },
    })
    await tx.embarquePackingList.updateMany({
      where: { embarqueId, eliminadoEn: null },
      data: { eliminadoEn: new Date(), eliminadoPor: actualizadoPor },
    })
    // FAS-GD-R4-005: descartar los borradores de Guía NO timbrados — un
    // TEMPORAL_CREADO/ERROR/PENDIENTE no debe sobrevivir a la anulación para
    // timbrarse en un ciclo de despacho posterior (su snapshot ya no
    // corresponde). Las timbradas/en proceso ya bloquearon la anulación arriba.
    await tx.documentoDte.deleteMany({
      where: { origenTipo: 'embarque', origenId: embarqueId, estado: { in: ['TEMPORAL_CREADO', 'ERROR', 'PENDIENTE'] } },
    })
    return 'OK' as const
  })
  return resultado
}

// ─── Packing List (compras.md §9.3, cierra EP-QA-003) ──────────────────────

// Pallets ya reservados a este Embarque, con el detalle mínimo que necesita
// el motor de reconciliación (embarques.packing-list.motor.ts) para el Paso
// 2 (compras.md §9.3) — a diferencia de palletInclude (usado en el detalle
// completo del Embarque), no trae relaciones de mantenedor, solo IDs.
export async function getPalletsReservadosParaReconciliar(embarqueId: number) {
  return prisma.pallet.findMany({
    where: { embarqueId },
    select: {
      numeroPallet: true,
      productorId: true,
      lineas: {
        select: { especieId: true, variedadId: true, categoriaId: true, articuloId: true, calibreId: true, cajas: true },
      },
    },
  })
}

// Entidades que pueden figurar como "Emisor de la Guía" del Packing List
// (2026-10-23): los productores (Pallet.productorId) y las plantas
// (Pallet.recepcion.plantaId) asociados a los pallets reservados al embarque —
// así el emisor queda acotado a quienes realmente despacharon fruta a este
// embarque. Se devuelve id/codigo/descripcion/razonSocial para matchear por
// texto (mismo criterio que recepcionesRepo.find*ByTexto).
export async function getEntidadesEmisorEmbarque(embarqueId: number) {
  const pallets = await prisma.pallet.findMany({
    where: { embarqueId },
    select: { productorId: true, recepcion: { select: { plantaId: true } } },
  })
  const ids = new Set<number>()
  for (const p of pallets) {
    ids.add(p.productorId)
    ids.add(p.recepcion.plantaId)
  }
  if (ids.size === 0) return []
  return prisma.entidad.findMany({
    where: { id: { in: [...ids] }, eliminadoEn: null },
    select: { id: true, codigo: true, descripcion: true, razonSocial: true },
  })
}

// Reemplaza la reconciliación vigente por una nueva — cada subida de Excel
// pisa la anterior (no se conserva historial, ver comentario en el modelo
// Prisma). Mismo advisory lock que confirmarDespacho/reservarPalletsEnEmbarque
// (LOCK_NAMESPACE_EMBARQUE_DESPACHO): sin esto, una subida concurrente con
// una reserva/desvinculación de pallets podría guardar un resultado OK
// calculado contra un conjunto de pallets que ya cambió.
export async function guardarPackingList(
  embarqueId: number,
  datos: {
    templateCargaId: number
    nombreArchivo: string
    mime: string
    tamano: number
    contenido: Buffer
    estado: 'OK' | 'DISCREPANCIA'
    discrepancias: string[]
    numerosPallet: string[]
    termografos: string[]
    // Datos por pallet resueltos por el motor (guía 2026-10-23; termógrafo/
    // temperatura 2026-10-25): se persisten en cada Pallet reconciliado (el PL no
    // guarda líneas propias). Solo trae los pallets que declararon algún dato de
    // forma consistente; cada campo es `undefined` si su columna no se declaró
    // (no se toca ese dato).
    datosPorPallet: DatoPalletReconciliado[]
    cargadoPor: string
  },
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_EMBARQUE_DESPACHO}::int, ${embarqueId}::int)`

    const embarque = await tx.embarque.findFirst({ where: { id: embarqueId, eliminadoEn: null }, select: { id: true } })
    if (!embarque) throw new ValidationError('El Embarque ya no existe')

    // Packing parcializado (2026-09-28): los archivos se ACUMULAN (ya no se
    // reemplaza el anterior). El "todo o nada" se valida por la unión al
    // despachar. Solape con pallets ya cubiertos: se revisa bajo este mismo
    // lock para que dos subidas concurrentes no cubran el mismo pallet.
    const activos = await tx.embarquePackingList.findMany({
      where: { embarqueId, eliminadoEn: null },
      select: { numerosPallet: true },
    })
    const yaCubiertos = new Set(activos.flatMap((a) => (a.numerosPallet as string[]) ?? []))
    const solapados = datos.numerosPallet.filter((n) => yaCubiertos.has(n))
    if (solapados.length > 0) {
      throw new ValidationError(
        `Estos N° de Pallet ya vienen en otro archivo de Packing List cargado a este Embarque: ${solapados.join(', ')}`,
      )
    }

    const empresaId = getEmpresaIdActual()!
    const creado = await tx.embarquePackingList.create({
      data: {
        empresaId,
        embarqueId,
        templateCargaId: datos.templateCargaId,
        nombreArchivo: datos.nombreArchivo,
        mime: datos.mime,
        tamano: datos.tamano,
        estado: datos.estado,
        discrepancias: datos.discrepancias,
        numerosPallet: datos.numerosPallet,
        termografos: datos.termografos,
        cargadoPor: datos.cargadoPor,
        contenido: { create: { datos: datos.contenido } },
      },
      select: packingListSelect,
    })

    // Persistir los datos por pallet reconciliados (guía 2026-10-23; termógrafo/
    // temperatura 2026-10-25). Solo si la reconciliación quedó en estado OK
    // (decisión de negocio: nada se consolida mientras haya discrepancias). El PL
    // es parcializado/acumulativo, así que solo se tocan los pallets de ESTE
    // archivo (sin solape con otros). Cada campo se escribe solo si fue declarado
    // (undefined = no tocar, QA-APL-003). Bajo el mismo lock del despacho — match
    // por (embarqueId, numeroPallet), único entre los pallets reservados.
    // updateMany porque no hay índice único declarado en ese par.
    if (datos.estado === 'OK') {
      for (const g of datos.datosPorPallet) {
        const dataPallet: { numeroGuiaDespacho?: string; emisorGuiaId?: number; termografo?: string; temperatura?: number } = {}
        if (g.numeroGuia !== undefined) dataPallet.numeroGuiaDespacho = g.numeroGuia
        if (g.emisorGuiaId !== undefined) dataPallet.emisorGuiaId = g.emisorGuiaId
        if (g.termografo !== undefined) dataPallet.termografo = g.termografo
        if (g.temperatura !== undefined) dataPallet.temperatura = g.temperatura
        if (Object.keys(dataPallet).length === 0) continue
        await tx.pallet.updateMany({
          where: { embarqueId, numeroPallet: g.numeroPallet, eliminadoEn: null },
          data: dataPallet,
        })
      }
    }

    return creado
  })
}

// Descarga de un archivo de Packing List. `packingListId` opcional por
// compatibilidad: sin él baja el primer archivo activo (packing parcializado
// 2026-09-28 admite N — el frontend pasa el id específico).
export async function getPackingListParaDescarga(embarqueId: number, packingListId?: number) {
  const meta = await prisma.embarquePackingList.findFirst({
    where: { embarqueId, eliminadoEn: null, ...(packingListId ? { id: packingListId } : {}) },
    select: { id: true, nombreArchivo: true, mime: true },
    orderBy: { cargadoEn: 'asc' },
  })
  if (!meta) return null
  const contenido = await prisma.embarquePackingListContenido.findUnique({ where: { packingListId: meta.id } })
  if (!contenido) return null
  return { meta, datos: contenido.datos }
}

// Elimina (soft delete) un archivo de Packing List — para corregir una carga
// parcial equivocada. Bloqueado si el Embarque ya está despachado.
export async function eliminarPackingList(embarqueId: number, packingListId: number, eliminadoPor: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_EMBARQUE_DESPACHO}::int, ${embarqueId}::int)`
    const embarque = await tx.embarque.findFirst({
      where: { id: embarqueId, eliminadoEn: null },
      select: { despachadoEn: true, despachoAnuladoEn: true },
    })
    if (!embarque) return 'NO_ENCONTRADO' as const
    if (embarque.despachadoEn && !embarque.despachoAnuladoEn) return 'DESPACHADO' as const
    // Pallets que cubría este archivo — para limpiar su guía de despacho al
    // eliminarlo (decisión de negocio 2026-10-23: la guía se consolida desde el
    // PL; si el archivo que la originó se elimina, se limpia de sus pallets).
    const pl = await tx.embarquePackingList.findFirst({
      where: { id: packingListId, embarqueId, eliminadoEn: null },
      select: { numerosPallet: true },
    })
    if (!pl) return 'NO_ENCONTRADO' as const
    const claim = await tx.embarquePackingList.updateMany({
      where: { id: packingListId, embarqueId, eliminadoEn: null },
      data: { eliminadoEn: new Date(), eliminadoPor },
    })
    if (claim.count === 0) return 'NO_ENCONTRADO' as const
    const numeros = (pl.numerosPallet as string[]) ?? []
    if (numeros.length > 0) {
      await tx.pallet.updateMany({
        where: { embarqueId, numeroPallet: { in: numeros }, eliminadoEn: null },
        data: { numeroGuiaDespacho: null, emisorGuiaId: null, termografo: null, temperatura: null },
      })
    }
    return 'OK' as const
  })
}

// Datos para EMITIR el Packing List (reporte Excel, 2026-10-25): cabecera del
// Embarque + pallets reservados (no eliminados) con sus líneas, productor (con
// predios para CSG/GGN) y planta (CSP). CSG/GGN se resuelven best-effort en el
// generador: solo si el productor tiene UN único Predio (el Pallet no enlaza a
// un Predio puntual).
export async function getDatosEmisionPackingList(embarqueId: number) {
  const comunaSel = { select: { descripcion: true, provincia: { select: { descripcion: true } } } }
  return prisma.embarque.findFirst({
    where: { id: embarqueId, eliminadoEn: null },
    select: {
      id: true,
      empresaId: true,
      numeroInstructivo: true,
      reservaManual: true,
      naveManual: true,
      numeroContenedorManual: true,
      fechaZarpeManual: true,
      awbBl: true,
      fechaArribo: true,
      puertoZarpe: { select: { descripcion: true } },
      naviera: { select: { razonSocial: true } },
      solicitudReserva: { select: { nave: true, numeroContenedor: true, fechaZarpe: true } },
      notaVenta: {
        select: {
          cliente: { select: { razonSocial: true, taxId: true, identificador: true } },
          consignatario: { select: { razonSocial: true } },
          puertoDestino: { select: { descripcion: true } },
          // Exportador efectivo de la NV (EXPORTADORA, FAS-PLE-R2-003): si existe,
          // manda sobre la empresa activa para la cabecera Exporter + RUT.
          exportador: { select: { razonSocial: true, identificador: true } },
        },
      },
      pallets: {
        where: { eliminadoEn: null },
        orderBy: { numeroPallet: 'asc' },
        select: {
          numeroPallet: true,
          temperatura: true,
          termografo: true,
          numeroGuiaDespacho: true,
          emisorGuia: { select: { razonSocial: true } },
          productor: {
            select: {
              razonSocial: true,
              // Solo predios VIGENTES (FAS-PLE-R1-001): la regla best-effort de
              // CSG/GGN (predio único) se evalúa sobre los no eliminados.
              predios: { where: { eliminadoEn: null }, select: { codigoCsg: true, codigoGgn: true, comuna: comunaSel } },
            },
          },
          recepcion: {
            select: {
              planta: {
                select: {
                  razonSocial: true,
                  csp: true,
                  // Dirección VIGENTE, determinista (FAS-PLE-R1-002): la marcada
                  // por defecto y, a igualdad, por código.
                  direcciones: {
                    where: { eliminadoEn: null },
                    orderBy: [{ esPorDefecto: 'desc' }, { codigo: 'asc' }],
                    take: 1,
                    select: { comuna: comunaSel },
                  },
                },
              },
            },
          },
          lineas: {
            select: {
              cajas: true,
              fechaEmbalaje: true,
              especie: { select: { descripcion: true } },
              variedad: { select: { descripcion: true } },
              categoria: { select: { descripcion: true } },
              calibre: { select: { descripcion: true } },
              articulo: { select: { codigo: true, descripcion: true, kgNetoEnvase: true } },
              etiqueta: { select: { descripcion: true } },
            },
          },
        },
      },
    },
  })
}

export async function findByNumeroInstructivo(numeroInstructivo: string) {
  return prisma.embarque.findFirst({ where: { numeroInstructivo, eliminadoEn: null } })
}

export async function getNotaVenta(id: number) {
  return prisma.notaVenta.findFirst({
    where: { id, eliminadoEn: null },
    select: {
      id: true,
      folio: true,
      tipoEmbarqueId: true,
      // requiereReserva gatea el intento de Solicitud de Reserva (solo
      // Aéreo/Marítimo; Terrestre no reserva — 2026-10-08).
      tipoEmbarque: { select: { requiereReserva: true } },
    },
  })
}

// Líneas del Cierre con lo necesario para estimar la cantidad de pallets
// (cajas y cajas por pallet, ya congeladas en NotaVentaDetalle).
export async function getDetallesCajasCierre(notaVentaId: number) {
  return prisma.notaVentaDetalle.findMany({
    where: { notaVentaId },
    select: { cajas: true, cajasPorPallet: true },
  })
}

// Valida existencia + tipo del Gestor Logístico elegido (ventas.md §4.3,
// mismo criterio que el consignatario en notas-venta.service.ts).
export async function getGestorLogistico(id: number) {
  return prisma.entidad.findFirst({
    where: { id, eliminadoEn: null, activo: true },
    select: { id: true, tipos: true },
  })
}

// Datos para armar el payload de la Solicitud de Reserva (ventas.md §4.3) —
// en este punto del flujo todavía no hay Embarque ni pallets asignados (eso
// pasa después, en "Seleccionar Pallets"), así que el "tamaño" que se envía
// es lo comprometido en el Cierre (cajas de NotaVentaDetalle), no pallets
// reales.
// Selección alineada al payload real de AGL360 (Docs/api-solicitudes.md,
// 2026-09-07) — reemplaza la versión anterior (armada antes de tener la
// definición real, con campos de texto libre que AGL360 no acepta).
export async function getNotaVentaParaReserva(id: number) {
  return prisma.notaVenta.findFirst({
    where: { id, eliminadoEn: null },
    select: {
      folio: true,
      clienteId: true,
      consignatarioId: true,
      tipoEmbarqueId: true,
      puertoDestinoId: true,
      direccionDetalle: true,
      detalles: { select: { especieId: true } },
    },
  })
}

export async function createEmbarque(notaVentaId: number, numeroInstructivo: string, creadoPor: string) {
  return prisma.embarque.create({
    // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe este
    // valor con la empresa activa del contexto — se declara aquí solo para
    // satisfacer el tipo requerido por Prisma.
    data: { empresaId: getEmpresaIdActual()!, notaVentaId, numeroInstructivo, creadoPor },
    include: { notaVenta: { select: notaVentaRefSelect } },
  })
}

// IMP-QA-R1-012 (QA ronda 1): el lock serializa TODO el intento (chequeo de
// numeroInstructivo + llamada a AGL360 vía `procesarReserva` + creación) por
// notaVentaId — sin esto, dos intentos concurrentes para el mismo Cierre
// pasaban ambos el chequeo (ninguno había creado nada todavía) y ambos
// llamaban a AGL360, generando dos solicitudes externas aunque solo una
// ganara la creación local después. `timeout`/`maxWait` ampliados porque la
// transacción queda abierta durante la llamada externa (`procesarReserva`,
// que hace `fetch` — ver agl360.adapter.ts) — aceptable mientras AGL360 no
// existe de verdad (mock es instantáneo); si el AGL360 real resulta lento,
// revisar este trade-off (deuda documentada, ventas.md §4.3).
//
// `forzarSinReserva` NO se usa para saltarse `procesarReserva` (IMP-QA-R1-013,
// QA ronda 1: eso permitía a cualquier llamado directo a la API evitar el
// intento) — solo decide qué hacer SI la integración falla: crear igual en
// PENDIENTE, o abortar (rollback completo, nada se crea) lanzando
// IntegracionAglFallidaError para que el frontend ofrezca el diálogo.
// `modoAutomatico` (2026-09-07, ventas.md §4.3 — generaliza el hardcode a
// AGL360): lo resuelve el service ANTES de entrar acá, consultando si
// `gestorLogisticoId` tiene una Integración activa con adapter real
// vinculada. Si es `false`, NUNCA se llama `procesarReserva` — el Embarque
// nace directo en `reservaManual=true`, sin intento ni diálogo de fallo
// (a diferencia del camino automático, donde un fallo SÍ puede abortar todo
// si `forzarSinReserva` es false).
export async function generarEmbarqueTransaccional(
  notaVentaId: number,
  prefijo: string,
  digitos: number,
  gestorLogisticoId: number,
  creadoPor: string,
  forzarSinReserva: boolean,
  modoAutomatico: boolean,
  // Si el tipo de embarque genera Solicitud de Reserva (Aéreo/Marítimo). Para
  // Terrestre (false) se crea el Embarque sin intentar AGL ni crear reserva.
  requiereReserva: boolean,
  procesarReserva: (numeroInstructivo: string) => Promise<ResultadoIntentoReserva>,
  // Información base del contenedor (2026-09-30) — se persiste en el Embarque
  // desde su creación (en vez de requerir la edición posterior vía
  // guardarDatosReservaBase).
  datosContenedor?: DatosContenedorInput,
) {
  const datosBase = {
    temperatura: datosContenedor?.temperatura ?? undefined,
    cbm: datosContenedor?.cbm ?? undefined,
    tipoBlId: datosContenedor?.tipoBlId ?? undefined,
  }
  return prisma.$transaction(async (tx) => {
    const empresaId = getEmpresaIdActual()!
    // Correlativo atómico por prefijo (FAS-DEV-QA-R2-006): el lock de prefijo
    // cubre el cálculo del máximo + la creación, así dos Cierres distintos con
    // el mismo prefijo no generan el mismo número. Se toma ANTES del lock por
    // notaVenta (orden estable para evitar deadlock).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_EMBARQUE_CORRELATIVO}::int, hashtext(${`${empresaId}:${prefijo}`}))`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_EMBARQUE_SOLICITUD_RESERVA}::int, ${notaVentaId}::int)`

    // Máximo sufijo numérico existente para el prefijo (incluye eliminados: un
    // número usado nunca se reutiliza) — calculado DENTRO de la tx bajo el lock.
    const registros = await tx.embarque.findMany({
      where: { numeroInstructivo: { startsWith: prefijo } },
      select: { numeroInstructivo: true },
    })
    let maximo = 0
    for (const { numeroInstructivo: n } of registros) {
      const num = parseInt(n.slice(prefijo.length), 10)
      if (!Number.isNaN(num) && num > maximo) maximo = num
    }
    const numeroInstructivo = `${prefijo}${String(maximo + 1).padStart(digitos, '0')}`

    // Tipo de embarque sin Solicitud de Reserva (Terrestre, 2026-10-08): se crea
    // el Embarque plano, sin llamar a AGL360 ni registrar SolicitudReserva y sin
    // modo manual. estadoReserva queda en su default (PENDIENTE); las acciones de
    // reserva están bloqueadas en el service (solicitarReservaParaEmbarque). El
    // despacho no depende de estadoReserva, así que no se bloquea.
    if (!requiereReserva) {
      return tx.embarque.create({
        data: { empresaId, notaVentaId, numeroInstructivo, gestorLogisticoId, creadoPor, ...datosBase },
        include: { notaVenta: { select: notaVentaRefSelect } },
      })
    }

    if (!modoAutomatico) {
      return tx.embarque.create({
        data: { empresaId, notaVentaId, numeroInstructivo, gestorLogisticoId, creadoPor, reservaManual: true, ...datosBase },
        include: { notaVenta: { select: notaVentaRefSelect } },
      })
    }

    const resultado = await procesarReserva(numeroInstructivo)
    if (!resultado.ok && !forzarSinReserva) {
      throw new IntegracionAglFallidaError(resultado.error ?? 'No se pudo conectar con AGL360')
    }

    const embarque = await tx.embarque.create({
      data: {
        empresaId,
        notaVentaId,
        numeroInstructivo,
        gestorLogisticoId,
        creadoPor,
        estadoReserva: resultado.ok ? 'SOLICITADA' : 'PENDIENTE',
        ...datosBase,
      },
    })
    if (resultado.ok) {
      await tx.solicitudReserva.create({
        data: {
          empresaId,
          embarqueId: embarque.id,
          referenciaFas: resultado.referenciaFas!,
          payloadEnviado: resultado.payloadEnviado as Prisma.InputJsonValue,
          payloadRespuesta: (resultado.payloadRespuesta ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          enviadoPor: creadoPor,
        },
      })
    }
    return tx.embarque.findFirstOrThrow({
      where: { id: embarque.id },
      include: { notaVenta: { select: notaVentaRefSelect } },
    })
  }, { timeout: 15_000, maxWait: 15_000 })
}

// Reintento manual desde un Embarque ya existente en PENDIENTE (pestaña
// "Solicitud de Reserva" del detalle) — mismo lock (clave embarqueId en vez
// de notaVentaId) y mismo motivo que generarEmbarqueTransaccional; a
// diferencia de esa, acá una falla SIEMPRE aborta (no hay "forzar" en el
// reintento — el Embarque ya existe en PENDIENTE de todos modos, no hay nada
// que perder con solo re-lanzar el error).
export async function solicitarReservaTransaccional(
  embarqueId: number,
  creadoPor: string,
  procesarReserva: () => Promise<ResultadoIntentoReserva>,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_EMBARQUE_SOLICITUD_RESERVA}::int, ${embarqueId}::int)`

    const embarque = await tx.embarque.findFirst({
      where: { id: embarqueId, eliminadoEn: null },
      select: { estadoReserva: true, reservaManual: true },
    })
    if (!embarque) throw new ValidationError('El Embarque ya no existe')
    if (embarque.estadoReserva !== 'PENDIENTE') {
      throw new ValidationError('Este Embarque ya tiene una Solicitud de Reserva enviada')
    }
    if (embarque.reservaManual) {
      throw new ValidationError('Este Embarque está en modo de reserva manual — ingresa los datos de booking directamente')
    }

    const resultado = await procesarReserva()
    if (!resultado.ok) {
      throw new IntegracionAglFallidaError(resultado.error ?? 'No se pudo conectar con AGL360')
    }

    const empresaId = getEmpresaIdActual()!
    await tx.solicitudReserva.create({
      data: {
        empresaId,
        embarqueId,
        referenciaFas: resultado.referenciaFas!,
        payloadEnviado: resultado.payloadEnviado as Prisma.InputJsonValue,
        payloadRespuesta: (resultado.payloadRespuesta ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        enviadoPor: creadoPor,
      },
    })
    return tx.embarque.update({
      where: { id: embarqueId },
      data: { estadoReserva: 'SOLICITADA' },
      include: { notaVenta: { select: notaVentaRefSelect } },
    })
  }, { timeout: 15_000, maxWait: 15_000 })
}

// "Dejar Manual" (2026-09-07, ventas.md §4.3) — desde un Embarque PENDIENTE
// (nunca se intentó, o el último intento automático falló), lo pasa a modo
// manual: reservaManual=true, habilita los campos de booking para tipeo
// directo. Mismo lock (namespace embarqueId) que solicitarReservaTransaccional
// para serializarse contra un reintento automático concurrente.
export async function marcarReservaManualTransaccional(embarqueId: number, actualizadoPor: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_EMBARQUE_SOLICITUD_RESERVA}::int, ${embarqueId}::int)`

    const embarque = await tx.embarque.findFirst({
      where: { id: embarqueId, eliminadoEn: null },
      select: { estadoReserva: true, reservaManual: true },
    })
    if (!embarque) throw new ValidationError('El Embarque ya no existe')
    if (embarque.estadoReserva !== 'PENDIENTE') {
      throw new ValidationError('Este Embarque ya tiene una Solicitud de Reserva enviada o confirmada')
    }
    if (embarque.reservaManual) {
      throw new ValidationError('Este Embarque ya está en modo de reserva manual')
    }

    return tx.embarque.update({
      where: { id: embarqueId },
      data: { reservaManual: true, actualizadoPor },
      include: { notaVenta: { select: notaVentaRefSelect } },
    })
  }, { timeout: 15_000, maxWait: 15_000 })
}

// Guarda los datos de booking manual (ventas.md §4.3) — exige
// reservaManual=true (defensa en profundidad vía updateMany condicionado,
// mismo patrón que reservarPalletsEnEmbarque). CONFIRMADA en cuanto se
// guarda, sin paso intermedio; queda editable después (no se bloquea tras
// la primera confirmación — decisión de negocio, Christian, 2026-09-07).
export async function guardarDatosReservaManual(embarqueId: number, datos: DatosReservaManualInput, actualizadoPor: string) {
  const claim = await prisma.embarque.updateMany({
    where: { id: embarqueId, eliminadoEn: null, reservaManual: true },
    data: {
      numeroBookingManual: datos.numeroBooking,
      naveManual: datos.nave,
      numeroContenedorManual: datos.numeroContenedor,
      fechaZarpeManual: datos.fechaZarpe,
      estadoReserva: 'CONFIRMADA',
      actualizadoPor,
    },
  })
  if (claim.count === 0) {
    const existe = await prisma.embarque.findFirst({ where: { id: embarqueId, eliminadoEn: null }, select: { id: true } })
    throw new ValidationError(
      existe ? 'Este Embarque no está en modo de reserva manual' : 'El Embarque ya no existe',
    )
  }
  return prisma.embarque.findFirstOrThrow({
    where: { id: embarqueId },
    include: { notaVenta: { select: notaVentaRefSelect } },
  })
}

// Sello/precinto del contenedor — editable en AMBOS modos de reserva (manual y
// AGL360), sin tocar `estadoReserva` ni la máquina de estados de la reserva. Es
// un dato operacional: si la API de AGL360 no lo trae, se completa a mano.
export async function actualizarSelloContenedor(embarqueId: number, numeroSello: string | null, actualizadoPor: string) {
  const claim = await prisma.embarque.updateMany({
    where: { id: embarqueId, eliminadoEn: null },
    data: { numeroSelloManual: numeroSello, actualizadoPor },
  })
  if (claim.count === 0) throw new ValidationError('El Embarque ya no existe')
  return prisma.embarque.findFirstOrThrow({
    where: { id: embarqueId },
    include: { notaVenta: { select: notaVentaRefSelect } },
  })
}

// Valida que el tipoBlId sea un Parametro de tipo TIPO_BL vigente (2026-09-28).
export async function getParametroTipoBl(id: number) {
  return prisma.parametro.findFirst({
    where: { id, eliminadoEn: null, bloqueado: false, tipoParametro: { codigo: 'TIPO_BL' } },
    select: { id: true },
  })
}

// Información base de la reserva (2026-09-28) — datos escalares propios del
// Embarque, editables siempre (independiente de reservaManual).
export async function guardarDatosReservaBase(embarqueId: number, datos: DatosReservaBaseInput, actualizadoPor: string) {
  const claim = await prisma.embarque.updateMany({
    where: { id: embarqueId, eliminadoEn: null },
    data: {
      fechaCompromiso: datos.fechaCompromiso,
      temperatura: datos.temperatura,
      cbm: datos.cbm,
      tipoBlId: datos.tipoBlId,
      actualizadoPor,
    },
  })
  if (claim.count === 0) throw new ValidationError('El Embarque ya no existe')
  return getEmbarqueById(embarqueId)
}

// ─── Instructivo de Embarque (2026-09-21, ventas.md R11) ───────────────────

// Existencia + tipos de una Entidad genérica — usado para validar
// agenteAduanaId/embarcadorId/navieraId contra su tipo esperado (mismo
// criterio que getGestorLogistico).
export async function getEntidadConTipos(id: number) {
  return prisma.entidad.findFirst({
    where: { id, eliminadoEn: null, activo: true },
    select: { id: true, tipos: true },
  })
}

export async function getPuertoPorId(id: number) {
  return prisma.puerto.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

// `stackingRangos` se maneja aparte del resto de `datos` (spread directo a
// Prisma): no es un campo escalar de Embarque, es una lista completa que se
// reemplaza entera (delete-then-create) dentro de la misma transacción —
// mismo criterio que TemplateCarga.campos en templates-carga.service.ts.
export async function guardarDatosInstructivo(embarqueId: number, datos: DatosInstructivoInput, actualizadoPor: string) {
  const { stackingRangos, ...resto } = datos
  await prisma.$transaction(async (tx) => {
    const claim = await tx.embarque.updateMany({
      where: { id: embarqueId, eliminadoEn: null },
      data: { ...resto, actualizadoPor },
    })
    if (claim.count === 0) throw new ValidationError('El Embarque ya no existe')

    if (stackingRangos) {
      await tx.embarqueStackingRango.deleteMany({ where: { embarqueId } })
      if (stackingRangos.length > 0) {
        const empresaId = getEmpresaIdActual()!
        await tx.embarqueStackingRango.createMany({
          data: stackingRangos.map((r, i) => ({ empresaId, embarqueId, desde: r.desde, hasta: r.hasta, orden: i + 1 })),
        })
      }
    }
  })
  return getEmbarqueById(embarqueId)
}

export async function contarInstructivosHijos(embarqueId: number) {
  return prisma.instructivoHijo.count({ where: { embarqueId, eliminadoEn: null } })
}

export async function listInstructivosHijos(embarqueId: number) {
  return prisma.instructivoHijo.findMany({
    where: { embarqueId, eliminadoEn: null },
    include: { planta: { select: entidadSelect } },
    orderBy: { secuencia: 'asc' },
  })
}

// Deriva los InstructivoHijo (uno por Planta) desde los pallets ya
// reservados al Embarque — botón explícito, no recomputa automáticamente
// (decisión de negocio, Christian, 2026-09-21). Idempotente: agrega
// instructivos para plantas nuevas, elimina los de plantas que ya no tienen
// pallets reservados, y NO toca los campos ya editados (fechaCargaPlanta/
// stacking/observaciones) de los que se mantienen — la secuencia/código de
// un instructivo que sobrevive nunca cambia, aunque se agreguen/quiten otros.
export async function generarInstructivosHijos(embarqueId: number, actualizadoPor: string) {
  return prisma.$transaction(async (tx) => {
    // FAS-IE-QA-005 (QA ronda 4): mismo lock que reservarPalletsEnEmbarque/
    // desvincularPallet/confirmarDespacho (LOCK_NAMESPACE_EMBARQUE_DESPACHO)
    // — antes usaba un namespace propio, que no serializaba esta lectura de
    // pallets contra una reserva/desvinculación concurrente sobre el mismo
    // Embarque.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_EMBARQUE_DESPACHO}::int, ${embarqueId}::int)`

    const embarque = await tx.embarque.findFirst({
      where: { id: embarqueId, eliminadoEn: null },
      select: { id: true, numeroInstructivo: true },
    })
    if (!embarque) throw new ValidationError('El Embarque ya no existe')

    const pallets = await tx.pallet.findMany({
      where: { embarqueId },
      select: { recepcion: { select: { plantaId: true } } },
    })
    // FAS-IE-QA-004 (QA ronda 3): 0 plantas es un resultado válido, no un
    // error — antes esto abortaba ANTES de llegar al paso de limpieza, así
    // que desvincular todos los pallets y volver a generar dejaba huérfanos
    // los InstructivoHijo de plantas que ya no aportan pallets (con PDF
    // todavía descargable, desactualizado). Ahora la sincronización corre
    // igual: elimina los obsoletos, no crea ninguno nuevo, devuelve [].
    const plantaIds = new Set(pallets.map((p) => p.recepcion.plantaId))

    // Solo entre ACTIVOS: uno soft-deleted (2026-09-22, "Anular Despacho" o
    // una sincronización anterior) no cuenta como "ya tiene instructivo" ni
    // debe volver a soft-eliminarse.
    const existentesActivos = await tx.instructivoHijo.findMany({ where: { embarqueId, eliminadoEn: null } })
    const plantasConInstructivo = new Set(existentesActivos.map((i) => i.plantaId))

    const aEliminar = existentesActivos.filter((i) => !plantaIds.has(i.plantaId))
    if (aEliminar.length > 0) {
      await tx.instructivoHijo.updateMany({
        where: { id: { in: aEliminar.map((i) => i.id) } },
        data: { eliminadoEn: new Date(), eliminadoPor: actualizadoPor },
      })
    }

    // La siguiente secuencia se calcula sobre TODAS las filas (incluidas las
    // soft-deleted): `codigo` es único para siempre, nunca se reutiliza un
    // número aunque la fila que lo tenía haya sido soft-eliminada.
    const secuenciaMaxima = await tx.instructivoHijo.aggregate({ where: { embarqueId }, _max: { secuencia: true } })
    const empresaId = getEmpresaIdActual()!
    let siguienteSecuencia = (secuenciaMaxima._max.secuencia ?? 0) + 1
    for (const plantaId of plantaIds) {
      if (plantasConInstructivo.has(plantaId)) continue
      await tx.instructivoHijo.create({
        data: {
          empresaId,
          embarqueId,
          plantaId,
          secuencia: siguienteSecuencia,
          codigo: `${embarque.numeroInstructivo}-${siguienteSecuencia}`,
          creadoPor: actualizadoPor,
        },
      })
      siguienteSecuencia += 1
    }

    return tx.instructivoHijo.findMany({
      where: { embarqueId, eliminadoEn: null },
      include: { planta: { select: entidadSelect } },
      orderBy: { secuencia: 'asc' },
    })
  })
}

// Detalle completo de un InstructivoHijo para el Motor de Documentos
// (resolvers/instructivo-embarque.resolver.ts) — reusado en vez de duplicar
// la query ahí (mismo criterio que "el resolver reusa el repository del
// módulo dueño de los datos", CLAUDE.md/Etapa 4 §4). Los pallets se
// consultan aparte, filtrados por la Planta de ESTE instructivo (un Embarque
// puede reservar pallets de varias plantas, cada InstructivoHijo solo
// documenta los suyos). `eliminadoEn: null` (FAS-AD-QA-002, QA ronda 3,
// 2026-09-22): un Instructivo soft-eliminado (Embarque despachado y luego
// anulado) deja de ser descargable/previsualizable por completo, aunque el
// registro siga en la BD para auditoría.
export async function getInstructivoHijoConDetalle(instructivoHijoId: number) {
  const instructivo = await prisma.instructivoHijo.findFirst({
    where: { id: instructivoHijoId, eliminadoEn: null },
    include: {
      embarque: {
        include: {
          notaVenta: {
            select: {
              clienteId: true,
              consignatarioId: true,
              notifyId: true,
              // Venta NACIONAL: el exportador del Instructivo es el cliente
              // (exportadora), no la empresa (2026-10-17).
              tipoVenta: true,
              tipoEmbarque: { select: mantenedorSelect },
              mercado: { select: mantenedorSelect },
              paisDestino: { select: { descripcion: true } },
              puertoDestino: { select: mantenedorSelect },
              // 2026-09-28: al PDF del Instructivo se agregan Tipo de Flete,
              // Modalidad de Venta e Incoterm (Cláusula de Venta), todos Parametro.
              tipoFlete: { select: mantenedorSelect },
              modalidadVenta: { select: mantenedorSelect },
              clausulaVenta: { select: mantenedorSelect },
            },
          },
          puertoZarpe: { select: mantenedorSelect },
          // FAS-IE-QA-006 (QA ronda 5): el booking efectivo depende del modo
          // de reserva — reservaManual=true usa los campos *Manual de acá
          // mismo, pero el camino automático lo guarda en SolicitudReserva
          // (ver resolver).
          solicitudReserva: {
            select: { numeroBooking: true, nave: true, numeroContenedor: true, fechaZarpe: true },
          },
          stackingRangos: { orderBy: { orden: 'asc' } },
        },
      },
    },
  })
  if (!instructivo) return null

  const pallets = await prisma.pallet.findMany({
    where: { embarqueId: instructivo.embarqueId, recepcion: { plantaId: instructivo.plantaId } },
    include: {
      productor: { select: { razonSocial: true } },
      lineas: {
        select: {
          especie: { select: mantenedorSelect },
          variedad: { select: mantenedorSelect },
          categoria: { select: mantenedorSelect },
          calibre: { select: mantenedorSelect },
          // kgNeto/kgBruto del envase para Peso Neto/Bruto por línea (2026-09-28).
          articulo: { select: { ...mantenedorSelect, kgNetoEnvase: true, kgBrutoEnvase: true } },
          cajas: true,
        },
      },
    },
    orderBy: { numeroPallet: 'asc' },
  })

  return { instructivo, pallets }
}

export async function updateInstructivoHijo(
  embarqueId: number,
  instructivoId: number,
  datos: InstructivoHijoUpdateInput,
  actualizadoPor: string,
) {
  const claim = await prisma.instructivoHijo.updateMany({
    where: { id: instructivoId, embarqueId, eliminadoEn: null },
    data: { ...datos, actualizadoPor },
  })
  if (claim.count === 0) throw new ValidationError('El Instructivo ya no existe para este Embarque')
  return prisma.instructivoHijo.findFirstOrThrow({
    where: { id: instructivoId },
    include: { planta: { select: entidadSelect } },
  })
}

// ─── Webhook AGL360 (confirmación) ──────────────────────────────────────────

// El webhook (embarques.controller.ts) extrae el empresaId de
// `referencia_externa` (el body real de AGL360 no trae empresaId, ver
// Docs/webhook-fas.md), lo valida contra `Empresa` (modelo no-tenant, no
// pasa por la extensión) y recién ahí fija `empresaContext` con ese valor
// ANTES de llamar esta función — por eso acá no se recibe `empresaId`: igual
// que el resto del repositorio, confía en el contexto ambiente, que la
// extensión de tenancy ya usa para filtrar automáticamente
// (prisma-tenancy.ts). `referenciaFas` solo es única DENTRO de una empresa
// (@@unique([empresaId, referenciaFas])), por eso el orden importa: sin el
// contexto ya fijado, esta consulta lanzaría EmpresaRequeridaError en vez de
// filtrar por la empresa correcta.
export async function getSolicitudPorReferencia(referenciaFas: string) {
  return prisma.solicitudReserva.findFirst({
    where: { referenciaFas },
    select: { id: true, embarqueId: true, confirmadoEn: true, idOrdenServicioAgl: true },
  })
}

// Contrato real del webhook (Docs/webhook-fas.md): solo trae
// idOrdenServicio/idSolicitudServicio/estadoOrden — nada de booking (BL,
// naviera, contenedor, fechas). Esos campos quedan sin poblar hasta que
// exista un endpoint de consulta aparte (ver nota en el schema Prisma).
export async function confirmarSolicitud(
  solicitudId: number,
  embarqueId: number,
  datos: {
    idOrdenServicioAgl: number
    idSolicitudServicioAgl: number
    estadoOrdenAgl: string
    payloadRespuesta: unknown
  },
) {
  await prisma.$transaction(async (tx) => {
    await tx.solicitudReserva.update({
      where: { id: solicitudId },
      data: {
        idOrdenServicioAgl: datos.idOrdenServicioAgl,
        idSolicitudServicioAgl: datos.idSolicitudServicioAgl,
        estadoOrdenAgl: datos.estadoOrdenAgl,
        payloadRespuesta: (datos.payloadRespuesta ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        confirmadoEn: new Date(),
      },
    })
    await tx.embarque.update({ where: { id: embarqueId }, data: { estadoReserva: 'CONFIRMADA' } })
  })
}

// ─── Guía de Despacho (DTE 52) ──────────────────────────────────────────────

// Carga el Embarque con lo necesario para armar la Guía de Despacho: estado de
// despacho, datos de transporte ya guardados, pallets (líneas con peso/cajas),
// Plantas de retiro (para la dirección de origen por defecto) y Puerto de
// zarpe (destino por defecto).
export async function getEmbarqueParaGuia(embarqueId: number) {
  return prisma.embarque.findFirst({
    where: { id: embarqueId, eliminadoEn: null },
    select: {
      id: true,
      despachadoEn: true,
      despachoAnuladoEn: true,
      guiaIndTraslado: true,
      guiaTransporteId: true,
      guiaChoferChileno: true,
      guiaChoferRut: true,
      guiaChoferNombre: true,
      guiaPatenteCamion: true,
      guiaPatenteRemolque: true,
      guiaDirOrigen: true,
      guiaComunaOrigen: true,
      guiaDirDestino: true,
      guiaComunaDestino: true,
      guiaExternaNumero: true,
      guiaExternaEmisorId: true,
      guiaExternaFecha: true,
      guiaExternaEmisor: { select: { id: true, razonSocial: true, identificador: true } },
      // Puerto de zarpe: descripción (destino en Transporte) + codigoAduana
      // (CodPtoEmbarque del bloque Aduana del DTE 52 de exportación).
      puertoZarpe: { select: { id: true, descripcion: true, codigoAduana: true } },
      // Agente de aduana (receptor de la Guía de exportación) + sus direcciones
      // con el puerto asociado (para elegir la que calza con el puerto de zarpe).
      agenteAduanaId: true,
      agenteAduana: {
        select: {
          id: true,
          razonSocial: true,
          identificador: true,
          giro: true,
          direcciones: {
            where: { eliminadoEn: null },
            select: {
              id: true,
              direccion: true,
              puertoId: true,
              esPorDefecto: true,
              comuna: { select: { descripcion: true } },
            },
            orderBy: [{ esPorDefecto: 'desc' }, { codigo: 'asc' }],
          },
        },
      },
      // Datos del bloque Aduana: se derivan de la Nota de Venta del Embarque
      // (sus codigoAduana), igual que la Factura de Exportación DTE 110.
      notaVenta: {
        select: {
          tipoEmbarque: { select: { codigoAduana: true } },
          paisDestino: { select: { codigoAduana: true, descripcion: true } },
          puertoDestino: { select: { codigoAduana: true } },
          modalidadVenta: { select: { codigoAduana: true } },
          clausulaVenta: { select: { codigoAduana: true, descripcion: true } },
        },
      },
      instructivosHijos: {
        where: { eliminadoEn: null },
        select: {
          id: true,
          plantaId: true,
          planta: {
            select: {
              razonSocial: true,
              // TODAS las direcciones de la planta (con id): el popup de la Guía
              // deja elegir desde cuál dirección de la planta se despacha.
              direcciones: {
                where: { eliminadoEn: null },
                select: { id: true, direccion: true, comuna: { select: { descripcion: true } } },
                orderBy: [{ esPorDefecto: 'desc' }, { codigo: 'asc' }],
              },
            },
          },
        },
      },
      pallets: {
        select: {
          lineas: {
            select: {
              especie: { select: { descripcion: true } },
              variedad: { select: { descripcion: true } },
              categoria: { select: { descripcion: true } },
              calibre: { select: { descripcion: true } },
              articulo: { select: { kgNetoEnvase: true, kgBrutoEnvase: true } },
              cajas: true,
            },
          },
        },
      },
    },
  })
}

interface DatosGuiaEmbarque {
  guiaIndTraslado: number
  guiaTransporteId: number | null
  guiaChoferChileno: boolean
  guiaChoferRut: string | null
  guiaChoferNombre: string | null
  guiaPatenteCamion: string | null
  guiaPatenteRemolque: string | null
  guiaDirOrigen: string | null
  guiaComunaOrigen: string | null
  guiaDirDestino: string | null
  guiaComunaDestino: string | null
}

// FAS-GD-R1-001 / R3-004 (BUG_REAL arbitrado + carrera): se ejecuta como
// `verificarVigencia` del motor DTE, es decir DENTRO de la transacción que ya
// tomó el advisory lock del origen (LOCK_NAMESPACE_DOCUMENTO_DTE_EMISION +
// hashtext('embarque:<id>')) justo antes de crear/retomar el documento. Dentro
// de esa única sección crítica: (1) rechaza si el DTE ya está timbrado/en
// proceso, (2) descarta el borrador no terminal para que se cree uno nuevo con
// los datos actuales, (3) revalida que el Embarque siga efectivamente
// despachado (cierra la carrera con anularDespacho) y (4) persiste los datos de
// transporte. Todo atómico ⇒ el payload emitido siempre coincide con el
// Embarque guardado, aun con ediciones/anulaciones concurrentes.
export async function prepararEmisionGuiaEnTx(
  tx: Prisma.TransactionClient,
  embarqueId: number,
  datos: DatosGuiaEmbarque,
  actualizadoPor: string,
): Promise<void> {
  const doc = await tx.documentoDte.findFirst({ where: { origenTipo: 'embarque', origenId: embarqueId } })
  if (doc && (doc.estado === 'GENERADO' || doc.estado === 'GENERANDO' || doc.estado === 'EMITIENDO')) {
    throw new ValidationError('La Guía de Despacho ya está timbrada o en proceso de timbrado; no se puede modificar')
  }
  if (doc) await tx.documentoDte.delete({ where: { id: doc.id } })
  const e = await tx.embarque.findFirst({
    where: { id: embarqueId, eliminadoEn: null },
    select: { despachadoEn: true, despachoAnuladoEn: true, guiaExternaNumero: true },
  })
  if (!e || !(e.despachadoEn && !e.despachoAnuladoEn)) {
    throw new ValidationError('El Embarque ya no está despachado — no se puede emitir la Guía de Despacho')
  }
  // Exclusión mutua (2026-10-12): si ya hay una Guía externa registrada, no se
  // puede emitir una propia. Re-chequeo bajo el lock DTE para cerrar la carrera
  // con registrarGuiaExterna (que toma el mismo lock).
  if (e.guiaExternaNumero != null) {
    throw new ValidationError('Este Embarque ya tiene registrada una Guía de Despacho externa; quítala antes de emitir una propia')
  }
  await tx.embarque.update({ where: { id: embarqueId }, data: { ...datos, actualizadoPor } })
}

// Revalida, dentro del lock del origen DTE (verificarVigencia del timbrado),
// que el Embarque siga efectivamente despachado antes de pasar el documento a
// GENERANDO — cierra la carrera anular/firmar (FAS-GD-R3-004).
export async function verificarEmbarqueDespachadoEnTx(tx: Prisma.TransactionClient, embarqueId: number): Promise<void> {
  const e = await tx.embarque.findFirst({
    where: { id: embarqueId, eliminadoEn: null },
    select: { despachadoEn: true, despachoAnuladoEn: true },
  })
  if (!e || !(e.despachadoEn && !e.despachoAnuladoEn)) {
    throw new ValidationError('El Embarque ya no está despachado — no se puede timbrar la Guía de Despacho')
  }
}

// RUT + razón social de la Entidad transportista (empresa de transporte) para
// el bloque Transporte del DTE 52.
export async function getTransportistaParaGuia(entidadId: number) {
  return prisma.entidad.findFirst({
    where: { id: entidadId, eliminadoEn: null },
    select: { id: true, identificador: true, razonSocial: true, tipos: true },
  })
}

// ─── Guía de Despacho emitida por un tercero (2026-10-12) ───────────────────

// Entidad emisora de una Guía externa: debe ser Productor o Planta, activa y
// con RUT (identificador) — el RUT es la mitad de la clave de duplicidad.
export async function getEmisorGuiaExterna(entidadId: number) {
  return prisma.entidad.findFirst({
    where: { id: entidadId, eliminadoEn: null },
    select: { id: true, identificador: true, razonSocial: true, tipos: true, activo: true },
  })
}

type GuiaExternaResultado =
  | 'OK'
  | 'NO_DESPACHADO'
  | 'TIENE_GUIA_PROPIA'
  | 'DUPLICADA'

// Registra (o reemplaza) la Guía externa de forma atómica, bajo el MISMO
// advisory lock del origen DTE que usan emitir/timbrar la Guía propia — así la
// exclusión mutua propia/externa es indivisible frente a una emisión
// concurrente. Dentro de la sección crítica: (1) revalida despacho vigente,
// (2) rechaza si ya existe un DocumentoDte propio no-ERROR (propia en curso o
// timbrada), (3) valida duplicidad por empresa (mismo emisor + número) y
// (4) persiste. El índice único parcial es la última línea de defensa.
export async function registrarGuiaExternaEnTx(
  embarqueId: number,
  datos: { emisorId: number; numero: string; fecha: Date | null },
  actualizadoPor: string,
): Promise<GuiaExternaResultado> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_DOCUMENTO_DTE_EMISION}::int, hashtext(${`embarque:${embarqueId}`}))`

    const e = await tx.embarque.findFirst({
      where: { id: embarqueId, eliminadoEn: null },
      select: { despachadoEn: true, despachoAnuladoEn: true },
    })
    if (!e || !(e.despachadoEn && !e.despachoAnuladoEn)) return 'NO_DESPACHADO' as const

    // Exclusión mutua: cualquier DocumentoDte propio no-ERROR bloquea la guía
    // externa (borrador temporal, emitiendo, generando o timbrado).
    const propia = await tx.documentoDte.findFirst({
      where: { origenTipo: 'embarque', origenId: embarqueId, estado: { not: 'ERROR' } },
      select: { id: true },
    })
    if (propia) return 'TIENE_GUIA_PROPIA' as const

    // Duplicidad por empresa (el tenant extension inyecta empresaId): mismo
    // emisor + mismo número en otro embarque.
    const dup = await tx.embarque.findFirst({
      where: {
        id: { not: embarqueId },
        eliminadoEn: null,
        guiaExternaEmisorId: datos.emisorId,
        guiaExternaNumero: datos.numero,
      },
      select: { id: true },
    })
    if (dup) return 'DUPLICADA' as const

    await tx.embarque.update({
      where: { id: embarqueId },
      data: {
        guiaExternaEmisorId: datos.emisorId,
        guiaExternaNumero: datos.numero,
        guiaExternaFecha: datos.fecha,
        actualizadoPor,
      },
    })
    return 'OK' as const
  })
}

// Quita la Guía externa registrada (deja el Embarque libre para emitir una
// propia). No toca el despacho ni ningún DTE.
export async function quitarGuiaExterna(embarqueId: number, actualizadoPor: string): Promise<void> {
  await prisma.embarque.update({
    where: { id: embarqueId },
    data: { guiaExternaEmisorId: null, guiaExternaNumero: null, guiaExternaFecha: null, actualizadoPor },
  })
}
