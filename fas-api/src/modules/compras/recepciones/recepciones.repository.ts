import type { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { ValidationError } from '../../../shared/errors.js'
import { LOCK_NAMESPACE_ORDEN_COMPRA_PROCESO } from '../../../shared/advisory-locks.js'
import { compararLineasOcConExcel, type FilaParaComparar } from './recepciones.comparacion.js'
import type { RecepcionCreateInput, RecepcionUpdateInput } from './recepciones.types.js'

const entidadSelect = { id: true, codigo: true, descripcion: true, razonSocial: true }
const direccionSelect = { id: true, codigo: true, descripcion: true, direccion: true }
const mantenedorSelect = { id: true, codigo: true, descripcion: true }

const includeDetalle = {
  ordenCompra: { select: { id: true, numero: true, estado: true } },
  planta: { select: entidadSelect },
  direccionPlanta: { select: direccionSelect },
  templateCarga: { select: mantenedorSelect },
  adjuntos: {
    select: { id: true, nombre: true, mime: true, tamano: true, subidoEn: true, subidoPor: true },
    orderBy: { subidoEn: 'desc' as const },
  },
  // QA-RCV-002 (ronda 1): el frontend necesita saber si ya hay pallets
  // generados para bloquear edición/carga/eliminación en consignación, donde
  // el estado por sí solo (CARGADA) no lo distingue — ver puedeModificarse()
  // en recepciones.service.ts.
  _count: { select: { pallets: true } },
}

// Namespace de advisory lock distinto al de OrdenCompra (490236) y NotaVenta
// (490234) — evita colisiones de correlativo entre módulos.
const LOCK_NAMESPACE_RECEPCION = 490237

// Namespace de advisory lock distinto de LOCK_NAMESPACE_RECEPCION (490237,
// usado para el correlativo) — este serializa el PROCESAMIENTO de una misma
// Recepción (QA-RCV-003): sin esto, dos cargas concurrentes podían pasar
// ambas el pre-check de `tienePallets` (hecho fuera de esta transacción, en
// el service) antes de que cualquiera terminara de escribir, y duplicar
// pallets. IMPQ-RCV-001 (ronda 1): el mismo lock también serializa
// actualizar/eliminar la Recepción contra la generación de pallets — antes
// solo lo tomaba crearPalletsYValidar, y editar/eliminar podían pasar su
// propio pre-check (puedeModificarse, en el service) al mismo tiempo que una
// carga de Excel concurrente generaba stock.
const LOCK_NAMESPACE_RECEPCION_PROCESO = 490238

export async function listRecepciones(page: number, limit: number, plantaId?: number, origen?: string, estado?: string) {
  const where = {
    eliminadoEn: null,
    ...(plantaId ? { plantaId } : {}),
    ...(origen ? { origen: origen as 'COMPRA' | 'CONSIGNACION' } : {}),
    ...(estado ? { estado: estado as 'CARGADA' | 'VALIDADA' | 'RECHAZADA' } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.recepcion.findMany({
      where,
      include: {
        ordenCompra: { select: { id: true, numero: true } },
        planta: { select: entidadSelect },
        // QA-RCV-002: mismo motivo que includeDetalle — el listado también
        // debe poder bloquear el botón "Eliminar" por fila.
        _count: { select: { pallets: true } },
      },
      orderBy: { id: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.recepcion.count({ where }),
  ])

  return { data, total }
}

export async function getRecepcionById(id: number) {
  return prisma.recepcion.findFirst({ where: { id, eliminadoEn: null }, include: includeDetalle })
}

export async function createRecepcion(data: RecepcionCreateInput, creadoPor: string) {
  const anio = new Date().getFullYear()
  const prefijo = `RC-${anio}-`
  const { ordenCompraId, ...resto } = data

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_RECEPCION}::int, ${anio}::int)`

    const total = await tx.recepcion.count({ where: { numero: { startsWith: prefijo } } })
    const numero = `${prefijo}${String(total + 1).padStart(4, '0')}`

    return tx.recepcion.create({
      data: {
        // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe
        // este valor con la empresa activa del contexto — se declara aquí
        // solo para satisfacer el tipo requerido por Prisma.
        empresaId: getEmpresaIdActual()!,
        ...resto,
        ordenCompraId: ordenCompraId ?? null,
        origen: ordenCompraId ? 'COMPRA' : 'CONSIGNACION',
        numero,
        creadoPor,
      },
      include: includeDetalle,
    })
  })
}

// IMPQ-RCV-001 (ronda 1): el pre-check del service (puedeModificarse, hecho
// antes de llamar a esta función) no es atómico con la escritura — una carga
// de Excel concurrente puede generar pallets justo después de ese chequeo y
// antes de este update. Tomar el mismo lock que crearPalletsYValidar y
// releer estado/eliminadoEn/pallets ya bajo el lock sí lo es: si perdió la
// carrera contra una carga que generó stock, o la Recepción ya no existe
// (eliminada por otra operación), aborta antes de escribir.
async function relockYReleerModificable(tx: Prisma.TransactionClient, id: number) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_RECEPCION_PROCESO}::int, ${id}::int)`
  const fresca = await tx.recepcion.findFirst({
    where: { id, eliminadoEn: null },
    include: { _count: { select: { pallets: true } } },
  })
  if (!fresca) throw new ValidationError('La Recepción ya no existe — pudo haber sido eliminada por otra operación')
  if (!['CARGADA', 'RECHAZADA'].includes(fresca.estado) || fresca._count.pallets > 0) {
    throw new ValidationError('La Recepción ya fue procesada por otra operación y no puede modificarse')
  }
  return fresca
}

export async function updateRecepcion(id: number, data: RecepcionUpdateInput, actualizadoPor: string) {
  return prisma.$transaction(async (tx) => {
    await relockYReleerModificable(tx, id)
    return tx.recepcion.update({
      where: { id },
      data: { ...data, actualizadoPor },
      include: includeDetalle,
    })
  })
}

export async function softDeleteRecepcion(id: number, eliminadoPor: string) {
  return prisma.$transaction(async (tx) => {
    await relockYReleerModificable(tx, id)
    return tx.recepcion.update({
      where: { id },
      data: { eliminadoEn: new Date(), eliminadoPor },
    })
  })
}

// ─── Validación de referencias ────────────────────────────────────────────────

export async function getEntidadPlanta(id: number) {
  return prisma.entidad.findFirst({ where: { id, eliminadoEn: null }, select: { id: true, tipos: true, activo: true } })
}

export async function getDireccionDeEntidad(direccionId: number, entidadId: number) {
  return prisma.entidadDireccion.findFirst({ where: { id: direccionId, entidadId, eliminadoEn: null } })
}

export async function getOrdenCompra(id: number) {
  return prisma.ordenCompra.findFirst({
    where: { id, eliminadoEn: null },
    select: { id: true, estado: true },
  })
}

// Ignora Recepciones eliminadas (soft delete) — una OC vuelve a estar
// disponible si su única Recepción previa fue eliminada (QAR-RCT-004). Se
// consulta aparte porque Prisma no filtra relaciones 1:1 dentro de `select`.
export async function getRecepcionActivaPorOrdenCompra(ordenCompraId: number) {
  return prisma.recepcion.findFirst({ where: { ordenCompraId, eliminadoEn: null }, select: { id: true } })
}

export async function getTemplateCarga(id: number) {
  return prisma.templateCarga.findFirst({ where: { id, eliminadoEn: null } })
}

// Con el mapeo de campos incluido — lo que necesita el lector de Excel
// (recepciones.excel.ts), a diferencia de getTemplateCarga() (solo valida
// existencia/estado al crear/editar la Recepción).
export async function getTemplateCargaParaLectura(id: number) {
  return prisma.templateCarga.findFirst({
    where: { id, eliminadoEn: null },
    select: {
      tieneCabecera: true,
      filaCabecera: true,
      filaPrimerRegistro: true,
      campos: { select: { campo: true, columna: true } },
    },
  })
}

// ─── Motor de validación de carga (compras.md §7) ─────────────────────────────
// Resolución de texto del Excel -> ID real. Match exacto (no `contains`),
// case-insensitive (decisión del usuario), contra `codigo` o `descripcion` —
// mismo patrón que `findMantenedorByCodigo` (config.repository.ts).

const insensible = { mode: 'insensitive' as const }

// Genera variantes singular/plural de un texto — el Excel puede traer
// "Manzanas" cuando el maestro tiene "Manzana" (o al revés). El español
// pluraliza agregando "s" (terminación en vocal) o "es" (terminación en
// consonante) en la enorme mayoría de nombres de fruta/variedad/calibre que
// aparecen acá; esto no es un singularizador general, solo cubre ese caso
// común sin arriesgar falsos positivos (sigue siendo match exacto contra
// cada variante, no `contains`).
function candidatosTexto(texto: string): string[] {
  const t = texto.trim()
  const candidatos = new Set([t])
  if (/es$/i.test(t)) candidatos.add(t.slice(0, -2)) // Limones -> Limon
  if (/s$/i.test(t)) candidatos.add(t.slice(0, -1)) // Manzanas -> Manzana
  if (!/s$/i.test(t)) {
    candidatos.add(`${t}s`) // Manzana -> Manzanas
    candidatos.add(`${t}es`) // Limon -> Limones
  }
  return [...candidatos]
}

function condicionesPorCampos(campos: readonly string[], texto: string) {
  return candidatosTexto(texto).flatMap((c) => campos.map((campo) => ({ [campo]: { equals: c, ...insensible } })))
}

export async function findEspecieByTexto(texto: string) {
  return prisma.especie.findFirst({
    where: { eliminadoEn: null, OR: condicionesPorCampos(['codigo', 'descripcion'], texto) },
  })
}

export async function findVariedadByTexto(especieId: number, texto: string) {
  return prisma.variedad.findFirst({
    where: { especieId, eliminadoEn: null, OR: condicionesPorCampos(['codigo', 'descripcion'], texto) },
  })
}

export async function findCategoriaByTexto(especieId: number, texto: string) {
  return prisma.categoria.findFirst({
    where: { especieId, eliminadoEn: null, OR: condicionesPorCampos(['codigo', 'descripcion'], texto) },
  })
}

export async function findCalibreByTexto(especieId: number, texto: string) {
  return prisma.calibre.findFirst({
    where: { especieId, eliminadoEn: null, OR: condicionesPorCampos(['codigo', 'descripcion'], texto) },
  })
}

export async function findArticuloByTexto(texto: string) {
  return prisma.articulo.findFirst({
    where: { tipo: 'EMBALAJE', activo: true, OR: condicionesPorCampos(['codigo', 'descripcion'], texto) },
  })
}

// El Packing List real trae en la columna "Productor" el código CSG del
// Predio (ej. "114802"), no el código/nombre de la Entidad productor — se
// busca primero por ahí. Si no hay match (predio sin CSG cargado, o el
// Excel excepcionalmente trae el código de la Entidad), se cae al match
// directo contra la Entidad como antes.
export async function findProductorByTexto(texto: string) {
  const t = texto.trim()
  const predio = await prisma.predio.findFirst({
    where: {
      eliminadoEn: null,
      codigoCsg: { equals: t, ...insensible },
      entidad: { eliminadoEn: null, activo: true, tipos: { has: 'PRODUCTOR' } },
    },
    include: { entidad: true },
  })
  if (predio) return predio.entidad

  return prisma.entidad.findFirst({
    where: {
      eliminadoEn: null,
      activo: true,
      tipos: { has: 'PRODUCTOR' },
      OR: condicionesPorCampos(['codigo', 'descripcion', 'razonSocial'], texto),
    },
  })
}

// OC con lineas + calibres, para el motor de comparación §7.2. Distinta de
// getOrdenCompra() (usada solo para validar estado al crear la Recepción).
export async function getOrdenCompraConLineas(id: number) {
  return prisma.ordenCompra.findFirst({
    where: { id, eliminadoEn: null },
    include: {
      lineas: {
        include: { calibres: { select: { calibreId: true } } },
      },
    },
  })
}

// Crea los Pallet/PalletLinea a partir de los grupos ya resueltos — todo en
// una transacción (todo o nada, compras.md §7.3: "Todo cuadra -> se cargan
// los pallets a Stock"). El estado final depende del modo (§8): modo OC pasa
// a VALIDADA (y la OC pasa a RECEPCIONADA, QA-RCV-001 — compras.md §6.2/§8:
// la OC es editable hasta recepcionar); consignación se queda en CARGADA (no
// existe transición propia para ese modo, aunque ya tenga pallets).
//
// `filas` (además de `pallets`, ya agrupados) viaja para poder re-hacer la
// comparación contra la OC (recepciones.comparacion.ts) DENTRO de esta
// transacción, con una lectura fresca de sus líneas bajo lock — QA-RCV-007:
// la comparación optimista del motor (recepciones.motor.ts) corre antes de
// esta transacción, así que por sí sola no protege contra una edición
// concurrente de la OC entre ese chequeo y la creación de pallets.
export async function crearPalletsYValidar(
  recepcionId: number,
  origen: 'COMPRA' | 'CONSIGNACION',
  ordenCompraId: number | null,
  templateCargaIdUsado: number | null,
  filas: FilaParaComparar[],
  pallets: Array<{
    numeroPallet: string
    productorId: number
    lineas: Array<{ especieId: number; variedadId: number; categoriaId: number; articuloId: number; calibreId: number; cajas: number }>
  }>,
) {
  const estadoFinal = origen === 'COMPRA' ? ('VALIDADA' as const) : ('CARGADA' as const)
  return prisma.$transaction(async (tx) => {
    // Lock + re-chequeo DENTRO de la transacción (QA-RCV-003): el pre-check
    // del service (estado/tienePallets) no es atómico con esta escritura —
    // esto sí lo es. Si otra carga concurrente ganó la carrera y ya generó
    // pallets, se aborta sin duplicar (todo-o-nada también aplica acá).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_RECEPCION_PROCESO}::int, ${recepcionId}::int)`
    const yaTienePallets = await tx.pallet.count({ where: { recepcionId } })
    if (yaTienePallets > 0) {
      throw new ValidationError('La Recepción ya fue procesada por otra carga concurrente')
    }
    // IMPQ-RCV-001 (ronda 1): mismo lock que ahora comparten
    // updateRecepcion/softDeleteRecepcion (relockYReleerModificable) — si un
    // PATCH/DELETE concurrente ganó la carrera y ya editó la cabecera o
    // eliminó la Recepción antes de que esta carga tomara el lock, aborta en
    // vez de generar pallets sobre datos obsoletos o una Recepción borrada.
    const recepcionFresca = await tx.recepcion.findFirst({ where: { id: recepcionId, eliminadoEn: null } })
    if (!recepcionFresca) throw new ValidationError('La Recepción ya no existe — pudo haber sido eliminada por otra operación')
    if (!['CARGADA', 'RECHAZADA'].includes(recepcionFresca.estado)) {
      throw new ValidationError('La Recepción ya no está en un estado que admita procesar una nueva carga')
    }
    // IMPQ-RCV-001 (ronda 2): el Excel ya se mapeó (Etapa 1, fuera del lock)
    // con el template leído al inicio de subirAdjunto(). Si un PATCH
    // concurrente cambió el template de la Recepción antes de este lock, esa
    // lectura quedó obsoleta — crear pallets igual dejaría la Recepción
    // persistida con un template distinto al que realmente se usó para leer
    // el archivo, sin trazabilidad. Se aborta y se pide reintentar la carga.
    if (recepcionFresca.templateCargaId !== templateCargaIdUsado) {
      throw new ValidationError('El Template de Carga de la Recepción cambió mientras se procesaba el Excel — vuelve a intentar la carga')
    }

    // QA-RCV-007: mismo lock que toman las mutaciones de OC en
    // ordenes-compra.repository.ts (LOCK_NAMESPACE_ORDEN_COMPRA_PROCESO) —
    // serializa esta carga contra cualquier edición/eliminación de línea o
    // de cabecera concurrente sobre la misma OC. Con el lock tomado, se
    // relee la OC (no se reutiliza lo que el motor leyó antes de la
    // transacción) y se recompara desde cero.
    if (origen === 'COMPRA' && ordenCompraId != null) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_ORDEN_COMPRA_PROCESO}::int, ${ordenCompraId}::int)`
      // eliminadoEn: null — QA-RCV-007 (ronda 4): sin este filtro, una OC
      // borrada (soft delete) justo antes de tomar este lock igual se
      // consideraba válida si conservaba estado EMITIDA.
      const ocFresca = await tx.ordenCompra.findFirst({
        where: { id: ordenCompraId, eliminadoEn: null },
        include: { lineas: { include: { calibres: { select: { calibreId: true } } } } },
      })
      if (!ocFresca) throw new ValidationError('La Orden de Compra de esta Recepción ya no existe')
      if (ocFresca.estado !== 'EMITIDA') {
        throw new ValidationError('La Orden de Compra ya no está en estado Emitida — no se pudo recepcionar')
      }
      const diferencias = compararLineasOcConExcel(ocFresca.lineas, filas)
      if (diferencias.length > 0) {
        throw new ValidationError('No coincide la OC con la carga', { diferencias })
      }
    }

    for (const p of pallets) {
      await tx.pallet.create({
        data: {
          // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe
          // este valor con la empresa activa del contexto — se declara aquí
          // solo para satisfacer el tipo requerido por Prisma (mismo patrón
          // que createRecepcion() más arriba en este archivo).
          empresaId: getEmpresaIdActual()!,
          recepcionId,
          numeroPallet: p.numeroPallet,
          origen,
          productorId: p.productorId,
          lineas: { create: p.lineas },
        },
      })
    }

    const recepcionActualizada = await tx.recepcion.update({
      where: { id: recepcionId },
      data: { estado: estadoFinal },
      include: includeDetalle,
    })

    // QA-RCV-001: la Recepción validada (modo OC) deja firme la OC — pasa a
    // RECEPCIONADA. Ya se confirmó EMITIDA/eliminadoEn:null arriba bajo el
    // mismo lock, pero la transición igual se condiciona por las tres
    // columnas (defensa en profundidad, QA-RCV-007 ronda 4) y aborta toda la
    // transacción si no afecta exactamente una fila.
    if (origen === 'COMPRA' && ordenCompraId != null) {
      const res = await tx.ordenCompra.updateMany({
        where: { id: ordenCompraId, estado: 'EMITIDA', eliminadoEn: null },
        data: { estado: 'RECEPCIONADA' },
      })
      if (res.count !== 1) {
        throw new ValidationError('La Orden de Compra ya no está en estado Emitida — no se pudo recepcionar')
      }
    }

    return recepcionActualizada
  })
}

export async function tienePallets(recepcionId: number) {
  const count = await prisma.pallet.count({ where: { recepcionId } })
  return count > 0
}

// updateMany (no update) a propósito: si esta carga perdió la carrera de
// concurrencia (QA-RCV-003) contra otra que sí generó stock, no debe
// pisarse con RECHAZADA. `estado: { not: 'VALIDADA' }` cubre el modo OC,
// pero consignación se queda en CARGADA aunque haya generado pallets
// (compras.md §8) — por eso `pallets: { none: {} }` es la condición
// realmente universal para ambos modos (QA-RCV-005, ronda 2: el primer fix
// solo cubría VALIDADA y dejaba marcar RECHAZADA una consignación exitosa).
export async function marcarRechazada(recepcionId: number) {
  return prisma.recepcion.updateMany({
    where: { id: recepcionId, estado: { not: 'VALIDADA' }, pallets: { none: {} } },
    data: { estado: 'RECHAZADA' },
  })
}

// ─── Adjuntos ──────────────────────────────────────────────────────────────

export async function createAdjunto(
  recepcionId: number,
  meta: { nombre: string; mime: string; tamano: number },
  datos: Buffer,
  subidoPor: string,
) {
  return prisma.recepcionAdjunto.create({
    data: { recepcionId, ...meta, subidoPor, contenido: { create: { datos } } },
    select: { id: true, nombre: true, mime: true, tamano: true, subidoEn: true, subidoPor: true },
  })
}

export async function getAdjuntoMeta(recepcionId: number, adjuntoId: number) {
  return prisma.recepcionAdjunto.findFirst({ where: { id: adjuntoId, recepcionId } })
}

export async function getAdjuntoContenido(adjuntoId: number) {
  return prisma.recepcionAdjuntoContenido.findUnique({ where: { adjuntoId } })
}

export async function deleteAdjunto(adjuntoId: number) {
  return prisma.recepcionAdjunto.delete({ where: { id: adjuntoId } })
}
