import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { BusinessError, ValidationError } from '../../../shared/errors.js'
import {
  LOCK_NAMESPACE_EMBARQUE_DESPACHO,
  LOCK_NAMESPACE_EMBARQUE_SOLICITUD_RESERVA,
} from '../../../shared/advisory-locks.js'
import { palletCalzaConDetalleNV } from './embarques.comparacion.js'
import type { DatosReservaManualInput, DatosInstructivoInput, InstructivoHijoUpdateInput } from './embarques.types.js'

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

export async function listEmbarques(page: number, limit: number, notaVentaId?: number) {
  const where = { eliminadoEn: null, ...(notaVentaId ? { notaVentaId } : {}) }
  const [data, total] = await Promise.all([
    prisma.embarque.findMany({
      where,
      include: { notaVenta: { select: notaVentaRefSelect }, _count: { select: { pallets: true } } },
      orderBy: { creadoEn: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.embarque.count({ where }),
  ])
  return { data, total }
}

export async function getEmbarqueById(id: number) {
  return prisma.embarque.findFirst({
    where: { id, eliminadoEn: null },
    include: {
      notaVenta: { select: notaVentaRefSelect },
      pallets: { include: palletInclude, orderBy: { id: 'asc' as const } },
      solicitudReserva: true,
      gestorLogistico: { select: entidadSelect },
      // Instructivo de Embarque (2026-09-21, ventas.md R11).
      puertoZarpe: { select: mantenedorSelect },
      agenteAduana: { select: entidadSelect },
      embarcador: { select: entidadSelect },
      naviera: { select: entidadSelect },
      instructivosHijos: { include: { planta: { select: entidadSelect } }, orderBy: { secuencia: 'asc' as const } },
      // Reconciliación de Packing List (compras.md §9.3) — sin `contenido`
      // (el blob se descarga aparte, ver getPackingListContenido).
      packingList: { select: packingListSelect },
    },
  })
}

// Detalle de la NV para el motor de comparación (§7 equivalente de
// Recepción, ver embarques.comparacion.ts) — mismo criterio que
// getOrdenCompraConLineas en recepciones.repository.ts.
export async function getNotaVentaConDetalle(id: number) {
  return prisma.notaVenta.findFirst({
    where: { id, eliminadoEn: null },
    include: { detalles: { include: { calibres: { select: { calibreId: true } } } } },
  })
}

// Pallets sin reservar (embarqueId null) que calzan con el detalle de la NV
// de este Embarque — candidatos para el paso "Seleccionar Pallets". El match
// es solo de catálogo (embarques.comparacion.ts), sin tope de cantidad.
export async function getPalletsDisponibles(
  detalleNV: NonNullable<Awaited<ReturnType<typeof getNotaVentaConDetalle>>>['detalles'],
) {
  // completo: true (2026-09-02, compras.md §4.8) — solo pallets completos
  // son elegibles para un Embarque; los incompletos siguen siendo stock
  // disponible pero no despachable.
  const pallets = await prisma.pallet.findMany({
    where: { embarqueId: null, completo: true },
    include: palletInclude,
    orderBy: { creadoEn: 'asc' },
  })
  return pallets.filter((p) => palletCalzaConDetalleNV(p.lineas, detalleNV))
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

    // completo: true — defensa en profundidad (2026-09-02, compras.md §4.8):
    // getPalletsDisponibles ya filtra los incompletos, pero esto evita que
    // un pallet marcado incompleto justo entre el listado y la reserva (o
    // llamado directo a la API) se cuele.
    const claim = await tx.pallet.updateMany({
      where: { id: { in: palletIds }, embarqueId: null, completo: true },
      data: { embarqueId },
    })
    if (claim.count !== palletIds.length) {
      throw new ValidationError('Uno o más pallets ya no están disponibles — puede que otro Embarque los haya reservado o que no estén marcados como Completos')
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

    const embarque = await tx.embarque.findFirst({ where: { id: embarqueId, eliminadoEn: null }, select: { despachadoEn: true } })
    if (!embarque) return 'NO_ENCONTRADO'
    if (embarque.despachadoEn) return 'DESPACHADO'

    const result = await tx.pallet.updateMany({ where: { id: palletId, embarqueId }, data: { embarqueId: null } })
    return result.count > 0 ? 'OK' : 'NO_ENCONTRADO'
  })
}

// Confirma el despacho — atómico y condicionado a que aún no esté despachado
// (evita una doble confirmación concurrente), a que tenga al menos un
// pallet reservado (decisión de negocio, Christian: no se despacha vacío) y,
// desde 2026-09-22 (compras.md §9.3, cierra EP-QA-003), a que exista una
// reconciliación de Packing List vigente en estado OK. Mismo advisory lock
// por embarqueId que desvincularPallet (EP-QA-002, QA ronda 2) — serializa
// ambas operaciones entre sí, y ahora también contra guardarPackingList.
export async function confirmarDespacho(embarqueId: number, despachadoPor: string) {
  // El read final (getEmbarqueById) corre DESPUÉS de que la transacción
  // commitea, no adentro — usar `prisma` en vez de `tx` dentro del callback
  // haría un read sucio contra una escritura todavía no confirmada.
  const resultado = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_EMBARQUE_DESPACHO}::int, ${embarqueId}::int)`

    const embarque = await tx.embarque.findFirst({
      where: { id: embarqueId, eliminadoEn: null },
      include: { _count: { select: { pallets: true } }, packingList: { select: { estado: true } } },
    })
    if (!embarque) return 'NO_ENCONTRADO' as const
    if (embarque.despachadoEn) return 'YA_DESPACHADO' as const
    if (embarque._count.pallets === 0) return 'SIN_PALLETS' as const
    if (!embarque.packingList) return 'SIN_PACKING_LIST' as const
    if (embarque.packingList.estado !== 'OK') return 'PACKING_LIST_CON_DISCREPANCIAS' as const

    const claim = await tx.embarque.updateMany({
      where: { id: embarqueId, despachadoEn: null },
      data: { despachadoEn: new Date(), despachadoPor },
    })
    return claim.count === 0 ? ('YA_DESPACHADO' as const) : ('OK' as const)
  })
  if (resultado !== 'OK') return resultado
  return getEmbarqueById(embarqueId)
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
    cargadoPor: string
  },
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_EMBARQUE_DESPACHO}::int, ${embarqueId}::int)`

    const embarque = await tx.embarque.findFirst({ where: { id: embarqueId, eliminadoEn: null }, select: { id: true } })
    if (!embarque) throw new ValidationError('El Embarque ya no existe')

    // delete-then-create en vez de upsert: la fila de contenido (bytes)
    // depende de la fila padre por FK cascade — recrear ambas de cero es más
    // simple que un update parcial de dos tablas relacionadas.
    await tx.embarquePackingList.deleteMany({ where: { embarqueId } })
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
        cargadoPor: datos.cargadoPor,
        contenido: { create: { datos: datos.contenido } },
      },
      select: packingListSelect,
    })
    return creado
  })
}

export async function getPackingListParaDescarga(embarqueId: number) {
  const meta = await prisma.embarquePackingList.findFirst({
    where: { embarqueId },
    select: { id: true, nombreArchivo: true, mime: true },
  })
  if (!meta) return null
  const contenido = await prisma.embarquePackingListContenido.findUnique({ where: { packingListId: meta.id } })
  if (!contenido) return null
  return { meta, datos: contenido.datos }
}

export async function findByNumeroInstructivo(numeroInstructivo: string) {
  return prisma.embarque.findFirst({ where: { numeroInstructivo, eliminadoEn: null } })
}

export async function getNotaVenta(id: number) {
  return prisma.notaVenta.findFirst({
    where: { id, eliminadoEn: null },
    select: { id: true, folio: true, tipoEmbarqueId: true },
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
  numeroInstructivo: string,
  gestorLogisticoId: number,
  creadoPor: string,
  forzarSinReserva: boolean,
  modoAutomatico: boolean,
  procesarReserva: () => Promise<ResultadoIntentoReserva>,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_EMBARQUE_SOLICITUD_RESERVA}::int, ${notaVentaId}::int)`

    const existente = await tx.embarque.findFirst({ where: { numeroInstructivo, eliminadoEn: null } })
    if (existente) {
      throw new ValidationError(
        `Ya existe un Embarque con el número "${numeroInstructivo}" — probablemente ya se generó un Embarque para este Cierre Comercial.`,
      )
    }

    const empresaId = getEmpresaIdActual()!

    if (!modoAutomatico) {
      return tx.embarque.create({
        data: { empresaId, notaVentaId, numeroInstructivo, gestorLogisticoId, creadoPor, reservaManual: true },
        include: { notaVenta: { select: notaVentaRefSelect } },
      })
    }

    const resultado = await procesarReserva()
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
      fechaRetiroPlantaManual: datos.fechaRetiroPlanta,
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

export async function guardarDatosInstructivo(embarqueId: number, datos: DatosInstructivoInput, actualizadoPor: string) {
  const claim = await prisma.embarque.updateMany({
    where: { id: embarqueId, eliminadoEn: null },
    data: { ...datos, actualizadoPor },
  })
  if (claim.count === 0) throw new ValidationError('El Embarque ya no existe')
  return getEmbarqueById(embarqueId)
}

export async function listInstructivosHijos(embarqueId: number) {
  return prisma.instructivoHijo.findMany({
    where: { embarqueId },
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

    const existentes = await tx.instructivoHijo.findMany({ where: { embarqueId } })
    const plantasConInstructivo = new Set(existentes.map((i) => i.plantaId))

    const aEliminar = existentes.filter((i) => !plantaIds.has(i.plantaId))
    if (aEliminar.length > 0) {
      await tx.instructivoHijo.deleteMany({ where: { id: { in: aEliminar.map((i) => i.id) } } })
    }

    const empresaId = getEmpresaIdActual()!
    let siguienteSecuencia = existentes.reduce((max, i) => Math.max(max, i.secuencia), 0) + 1
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
      where: { embarqueId },
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
// documenta los suyos).
export async function getInstructivoHijoConDetalle(instructivoHijoId: number) {
  const instructivo = await prisma.instructivoHijo.findFirst({
    where: { id: instructivoHijoId },
    include: {
      embarque: {
        include: {
          notaVenta: {
            select: {
              clienteId: true,
              consignatarioId: true,
              notifyId: true,
              tipoEmbarque: { select: mantenedorSelect },
              mercado: { select: mantenedorSelect },
              paisDestino: { select: { descripcion: true } },
              puertoDestino: { select: mantenedorSelect },
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
          articulo: { select: mantenedorSelect },
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
    where: { id: instructivoId, embarqueId },
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
