import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../../shared/errors.js'
import { LOCK_NAMESPACE_RECLAMO_PALLET_LINEA } from '../../../shared/advisory-locks.js'
import type { Procedencia, ProvisionInput, ReclamoLineaInput, ReclamoListFilters } from './reclamos.types.js'

type Tx = Prisma.TransactionClient

const mantenedorSelect = { id: true, codigo: true, descripcion: true }

const palletLineaInclude = {
  pallet: { select: { id: true, numeroPallet: true } },
  especie: { select: mantenedorSelect },
  variedad: { select: mantenedorSelect },
  categoria: { select: mantenedorSelect },
  calibre: { select: mantenedorSelect },
  articulo: { select: { id: true, codigo: true, descripcion: true, kgNetoEnvase: true } },
} satisfies Prisma.PalletLineaInclude

const reclamoInclude = {
  embarque: { select: { id: true, numeroInstructivo: true } },
  cliente: { select: mantenedorSelect },
  moneda: { select: mantenedorSelect },
  lineas: { include: { palletLinea: { include: palletLineaInclude } } },
  documentos: { select: { id: true, nombre: true, mime: true, tamano: true, subidoEn: true, subidoPor: true } },
  provisiones: { orderBy: { fechaCreacion: 'desc' as const } },
} satisfies Prisma.ReclamoInclude

// API externa (2026-09-08): sin sesión FAS, no hay empresaId en el contexto
// todavía cuando llega el request — se resuelve ACÁ, con `$queryRaw` (los
// query raw no pasan por la extensión de tenencia, a diferencia de
// `prisma.reclamo.findFirst`, que sí exigiría un empresaId que todavía no
// existe). Mismo patrón que el webhook AGL360 (embarques.controller.ts):
// resolver el tenant primero, recién después setear el contexto y seguir
// con las queries normales.
export async function getEmpresaIdDeReclamo(reclamoId: number): Promise<number | null> {
  const rows = await prisma.$queryRaw<{ empresaId: number }[]>`
    SELECT "empresaId" FROM reclamos WHERE id = ${reclamoId} AND "eliminadoEn" IS NULL
  `
  return rows[0]?.empresaId ?? null
}

// IMP-QA-R1-023: además de los IDs (usados para crear el Reclamo), trae la
// descripción de cliente/moneda — el diálogo de creación los muestra como
// heredados/no-editables en vez de dejarlos invisibles.
export async function getEmbarqueParaReclamo(embarqueId: number) {
  return prisma.embarque.findFirst({
    where: { id: embarqueId, eliminadoEn: null },
    select: {
      id: true,
      numeroInstructivo: true,
      notaVenta: {
        select: {
          clienteId: true,
          monedaId: true,
          cliente: { select: mantenedorSelect },
          moneda: { select: mantenedorSelect },
        },
      },
    },
  })
}

// Suma de cajas ya reclamadas por línea, entre TODOS los reclamos no
// eliminados (R-NEW1) — usado tanto para armar "cuánto queda disponible"
// (candidatos del selector) como para validar al crear/editar un reclamo.
// `excludeReclamoId` (IMP-QA-R1-019): al EDITAR un reclamo existente, sus
// propias líneas actuales no deben contarse como "ya reclamado por otro" —
// se reemplazan, no se suman.
async function getCantidadReclamadaPorLinea(
  palletLineaIds: number[],
  tx: Tx | typeof prisma = prisma,
  excludeReclamoId?: number,
): Promise<Map<number, number>> {
  if (palletLineaIds.length === 0) return new Map()
  const rows = await tx.reclamoPalletLinea.groupBy({
    by: ['palletLineaId'],
    where: {
      palletLineaId: { in: palletLineaIds },
      reclamo: { eliminadoEn: null },
      ...(excludeReclamoId ? { reclamoId: { not: excludeReclamoId } } : {}),
    },
    _sum: { cantidadCajas: true },
  })
  return new Map(rows.map((r) => [r.palletLineaId, r._sum.cantidadCajas ?? 0]))
}

// Reclamo "reclamado" (IMP-QA-R1-021): guarda atómicamente que el reclamo
// exista, no esté eliminado y no esté CERRADO, dentro de la MISMA
// transacción que la mutación real — el UPDATE deja la fila bloqueada hasta
// el commit, así que un cierre concurrente no puede colarse en la ventana
// entre "chequear estado" y "escribir" (a diferencia de un SELECT + UPDATE
// separados). 403 (ForbiddenError) si está cerrado, 404 si no existe —
// exigido por R9/CA10 (antes devolvía 422).
async function claimReclamoNoCerrado(tx: Tx, id: number, actualizadoPor: string): Promise<void> {
  const claim = await tx.reclamo.updateMany({
    where: { id, eliminadoEn: null, estado: { not: 'CERRADO' } },
    data: { actualizadoPor },
  })
  if (claim.count > 0) return
  const existe = await tx.reclamo.findFirst({ where: { id, eliminadoEn: null }, select: { id: true } })
  if (!existe) throw new NotFoundError('Reclamo', String(id))
  throw new ForbiddenError('El Reclamo está cerrado — no admite modificaciones (R9)')
}

// Candidatos para el selector del frontend (por pallet o por
// características, reclamos.md §7) — todas las líneas de pallets del
// Embarque, con cuánto ya está reclamado y cuánto queda disponible.
export async function getLineasReclamables(embarqueId: number) {
  const pallets = await prisma.pallet.findMany({
    where: { embarqueId },
    include: { lineas: { include: palletLineaInclude } },
    orderBy: { numeroPallet: 'asc' },
  })
  const palletLineaIds = pallets.flatMap((p) => p.lineas.map((l) => l.id))
  const reclamado = await getCantidadReclamadaPorLinea(palletLineaIds)
  return pallets.map((p) => ({
    ...p,
    lineas: p.lineas.map((l) => {
      const cajasReclamadas = reclamado.get(l.id) ?? 0
      return { ...l, cajasReclamadas, cajasDisponibles: l.cajas - cajasReclamadas }
    }),
  }))
}

interface DatosReclamo {
  embarqueId: number
  clienteId: number
  monedaId: number
  fechaReclamo?: string | null
  resumenCliente?: string | null
  temporadaId?: number | null
  lineas: ReclamoLineaInput[]
}

// Calcula el monto de una Provisión según su tipo de cálculo (reclamos.md
// §4/RC-D10). `cantidadAfectada` es sugerida desde las líneas marcadas si no
// viene explícita (RC-D10: "sugerida... editable").
function calcularMontoProvision(
  input: ProvisionInput,
  totales: { cajas: number; kilos: number },
): { cantidadAfectada: Prisma.Decimal | null; montoCalculado: Prisma.Decimal } {
  if (input.tipoCalculo === 'MONTO_FIJO') {
    const monto = new Prisma.Decimal(input.montoFijo!)
    return { cantidadAfectada: null, montoCalculado: monto }
  }
  const disponible = input.tipoCalculo === 'POR_UNIDAD_CAJA' ? totales.cajas : totales.kilos
  const cantidad = input.cantidadAfectada != null ? input.cantidadAfectada : disponible
  if (cantidad > disponible) {
    throw new ValidationError(
      `La cantidad afectada de la Provisión (${cantidad}) supera lo reclamado en el mismo Reclamo (${disponible}) (PR2)`,
    )
  }
  const cantidadDec = new Prisma.Decimal(cantidad)
  const monto = cantidadDec.mul(input.valorUnitario!)
  return { cantidadAfectada: cantidadDec, montoCalculado: monto }
}

// Transacción de creación (reclamos.md R-NEW1/R-NEW2, PR1/PR2): toma un
// advisory lock por cada PalletLinea marcada (orden ascendente de id, evita
// deadlock si dos Reclamos concurrentes marcan líneas en distinto orden),
// revalida bajo lock que cada línea pertenece al Embarque y que la cantidad
// pedida no supera lo disponible, y recién ahí crea el Reclamo + líneas +
// Provisión inicial opcional.
export async function crearReclamoTransaccional(
  datos: DatosReclamo,
  provisionInput: ProvisionInput | null | undefined,
  creadoPor: string,
) {
  return prisma.$transaction(async (tx) => {
    const empresaId = getEmpresaIdActual()!
    const palletLineaIds = [...new Set(datos.lineas.map((l) => l.palletLineaId))].sort((a, b) => a - b)

    for (const id of palletLineaIds) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_RECLAMO_PALLET_LINEA}::int, ${id}::int)`
    }

    const lineasDb = await tx.palletLinea.findMany({
      where: { id: { in: palletLineaIds } },
      select: { id: true, cajas: true, pallet: { select: { embarqueId: true } }, articulo: { select: { kgNetoEnvase: true } } },
    })
    if (lineasDb.length !== palletLineaIds.length) {
      throw new ValidationError('Una o más líneas de pallet ya no existen')
    }
    const lineasPorId = new Map(lineasDb.map((l) => [l.id, l]))
    const reclamadoPrevio = await getCantidadReclamadaPorLinea(palletLineaIds, tx)

    let totalCajas = 0
    let totalKilos = 0
    for (const linea of datos.lineas) {
      const db = lineasPorId.get(linea.palletLineaId)!
      // R-NEW2: la línea debe pertenecer al mismo Embarque del Reclamo.
      if (db.pallet.embarqueId !== datos.embarqueId) {
        throw new ValidationError(`La línea ${linea.palletLineaId} no pertenece a este Embarque (R-NEW2)`)
      }
      // R-NEW1: acumulado entre reclamos distintos, no solo dentro de este.
      const yaReclamado = reclamadoPrevio.get(linea.palletLineaId) ?? 0
      const disponible = db.cajas - yaReclamado
      if (linea.cantidadCajas > disponible) {
        throw new ValidationError(
          `La línea ${linea.palletLineaId} tiene ${disponible} caja(s) disponible(s) (de ${db.cajas}), se pidieron ${linea.cantidadCajas} (R-NEW1)`,
        )
      }
      totalCajas += linea.cantidadCajas
      totalKilos += linea.cantidadCajas * Number(db.articulo.kgNetoEnvase ?? 0)
    }

    const reclamo = await tx.reclamo.create({
      data: {
        empresaId,
        embarqueId: datos.embarqueId,
        clienteId: datos.clienteId,
        monedaId: datos.monedaId,
        fechaReclamo: datos.fechaReclamo ?? undefined,
        resumenCliente: datos.resumenCliente ?? undefined,
        temporadaId: datos.temporadaId ?? undefined,
        creadoPor,
        lineas: {
          create: datos.lineas.map((l) => ({ palletLineaId: l.palletLineaId, cantidadCajas: l.cantidadCajas })),
        },
      },
    })

    if (provisionInput) {
      const { cantidadAfectada, montoCalculado } = calcularMontoProvision(provisionInput, {
        cajas: totalCajas,
        kilos: totalKilos,
      })
      await tx.provision.create({
        data: {
          empresaId,
          reclamoId: reclamo.id,
          tipoCalculo: provisionInput.tipoCalculo,
          valorUnitario: provisionInput.valorUnitario ?? undefined,
          cantidadAfectada: cantidadAfectada ?? undefined,
          montoFijo: provisionInput.tipoCalculo === 'MONTO_FIJO' ? provisionInput.montoFijo : undefined,
          montoCalculado,
          creadoPorId: creadoPor,
        },
      })
    }

    return tx.reclamo.findUniqueOrThrow({ where: { id: reclamo.id }, include: reclamoInclude })
  }, { timeout: 15_000, maxWait: 15_000 })
}

interface DatosReclamoUpdate {
  fechaReclamo?: string | null
  resumenCliente?: string | null
  temporadaId?: number | null
  lineas?: ReclamoLineaInput[]
}

// Edición de cabecera/líneas (IMP-QA-R1-019, faltaba — está en el contrato
// de reclamos.md §6 desde el principio). Mientras no esté CERRADO
// (claimReclamoNoCerrado). Si vienen `lineas`, se REEMPLAZA el set completo
// (no un merge) — mismos locks y validación R-NEW1/R-NEW2 que al crear,
// excluyendo las líneas propias del reclamo del cálculo de "ya reclamado"
// (se están reemplazando, no sumando).
export async function actualizarReclamoTransaccional(
  id: number,
  embarqueId: number,
  datos: DatosReclamoUpdate,
  actualizadoPor: string,
) {
  return prisma.$transaction(async (tx) => {
    await claimReclamoNoCerrado(tx, id, actualizadoPor)

    const reclamoActual = await tx.reclamo.findFirst({ where: { id, eliminadoEn: null }, select: { embarqueId: true } })
    if (!reclamoActual) throw new NotFoundError('Reclamo', String(id))
    if (reclamoActual.embarqueId !== embarqueId) {
      throw new ValidationError('El Reclamo no pertenece a este Embarque')
    }

    if (datos.lineas) {
      const palletLineaIds = [...new Set(datos.lineas.map((l) => l.palletLineaId))].sort((a, b) => a - b)
      for (const lineaId of palletLineaIds) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_RECLAMO_PALLET_LINEA}::int, ${lineaId}::int)`
      }

      const lineasDb = await tx.palletLinea.findMany({
        where: { id: { in: palletLineaIds } },
        select: { id: true, cajas: true, pallet: { select: { embarqueId: true } }, articulo: { select: { kgNetoEnvase: true } } },
      })
      if (lineasDb.length !== palletLineaIds.length) {
        throw new ValidationError('Una o más líneas de pallet ya no existen')
      }
      const lineasPorId = new Map(lineasDb.map((l) => [l.id, l]))
      const reclamadoPrevio = await getCantidadReclamadaPorLinea(palletLineaIds, tx, id)

      let totalCajasNuevo = 0
      let totalKilosNuevo = 0
      for (const linea of datos.lineas) {
        const db = lineasPorId.get(linea.palletLineaId)!
        if (db.pallet.embarqueId !== embarqueId) {
          throw new ValidationError(`La línea ${linea.palletLineaId} no pertenece a este Embarque (R-NEW2)`)
        }
        const yaReclamado = reclamadoPrevio.get(linea.palletLineaId) ?? 0
        const disponible = db.cajas - yaReclamado
        if (linea.cantidadCajas > disponible) {
          throw new ValidationError(
            `La línea ${linea.palletLineaId} tiene ${disponible} caja(s) disponible(s) (de ${db.cajas}), se pidieron ${linea.cantidadCajas} (R-NEW1)`,
          )
        }
        totalCajasNuevo += linea.cantidadCajas
        totalKilosNuevo += linea.cantidadCajas * Number(db.articulo.kgNetoEnvase ?? 0)
      }

      // IMP-QA-R3-026: PR2 es una invariante permanente, no solo un chequeo
      // al crear la Provisión — reducir las líneas de un reclamo no puede
      // dejar una Provisión VIGENTE con `cantidadAfectada` por sobre lo que
      // queda reclamado. Se rechaza la edición completa (422) en vez de
      // reversar la Provisión sola — la reversa automática está reservada
      // para el efecto de Valorizar (R6), no para un simple ajuste de líneas.
      const provisionesVigentes = await tx.provision.findMany({
        where: { reclamoId: id, estado: 'VIGENTE' },
        select: { tipoCalculo: true, cantidadAfectada: true },
      })
      for (const p of provisionesVigentes) {
        if (p.tipoCalculo === 'MONTO_FIJO' || p.cantidadAfectada == null) continue
        const disponible = p.tipoCalculo === 'POR_UNIDAD_CAJA' ? totalCajasNuevo : totalKilosNuevo
        if (Number(p.cantidadAfectada) > disponible) {
          throw new ValidationError(
            `Esta edición dejaría una Provisión vigente (${p.cantidadAfectada}) por sobre lo reclamado (${disponible}) — reversa o ajusta la Provisión antes de reducir las líneas (PR2)`,
          )
        }
      }

      await tx.reclamoPalletLinea.deleteMany({ where: { reclamoId: id } })
      await tx.reclamoPalletLinea.createMany({
        data: datos.lineas.map((l) => ({ reclamoId: id, palletLineaId: l.palletLineaId, cantidadCajas: l.cantidadCajas })),
      })
    }

    await tx.reclamo.update({
      where: { id },
      data: {
        ...(datos.fechaReclamo !== undefined ? { fechaReclamo: datos.fechaReclamo } : {}),
        ...(datos.resumenCliente !== undefined ? { resumenCliente: datos.resumenCliente } : {}),
        ...(datos.temporadaId !== undefined ? { temporadaId: datos.temporadaId } : {}),
        actualizadoPor,
      },
    })

    return tx.reclamo.findUniqueOrThrow({ where: { id }, include: reclamoInclude })
  }, { timeout: 15_000, maxWait: 15_000 })
}

export async function listReclamosPorEmbarque(embarqueId: number) {
  return prisma.reclamo.findMany({
    where: { embarqueId, eliminadoEn: null },
    include: reclamoInclude,
    orderBy: { creadoEn: 'desc' },
  })
}

export async function listReclamos(filters: ReclamoListFilters) {
  const { page = 1, limit = 20, estado, embarqueId, clienteId, folio } = filters
  const where: Prisma.ReclamoWhereInput = {
    eliminadoEn: null,
    ...(estado ? { estado } : {}),
    ...(embarqueId ? { embarqueId } : {}),
    ...(clienteId ? { clienteId } : {}),
    // IMP-QA-R1-022: búsqueda por folio (numeroInstructivo) del Embarque —
    // el Reclamo no tiene número propio (RC-D11), se busca por el del padre.
    ...(folio ? { embarque: { numeroInstructivo: { contains: folio, mode: 'insensitive' } } } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.reclamo.findMany({
      where,
      include: reclamoInclude,
      orderBy: { creadoEn: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.reclamo.count({ where }),
  ])
  return { data, total }
}

export async function getReclamoById(id: number) {
  return prisma.reclamo.findFirst({ where: { id, eliminadoEn: null }, include: reclamoInclude })
}

// IMP-QA-R1-021: claim atómico (existe + no CERRADO) en la misma escritura
// — antes hacía update directo sin chequear estado en absoluto.
export async function updateAnalisisCalidad(id: number, comentarioCalidad: string, actualizadoPor: string) {
  return prisma.$transaction(async (tx) => {
    await claimReclamoNoCerrado(tx, id, actualizadoPor)
    await tx.reclamo.update({ where: { id }, data: { comentarioCalidad, actualizadoPor } })
    return tx.reclamo.findUniqueOrThrow({ where: { id }, include: reclamoInclude })
  })
}

// Valorizar (R6) reversa solas las Provisiones VIGENTE del reclamo — efecto
// de sistema, no pasa por el chequeo "no la reversa quien la creó" de PR3
// (eso es solo para la reversa manual, ver reversarProvision).
// IMP-QA-R1-021: el claim (existe + no CERRADO) y la escritura de
// valorización van en el MISMO `updateMany` — cierra la ventana de carrera
// que un SELECT+UPDATE separados dejaban abierta.
export async function valorizarReclamoTransaccional(id: number, valorConfirmado: number, userId: string) {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.reclamo.updateMany({
      where: { id, eliminadoEn: null, estado: { not: 'CERRADO' } },
      data: {
        valorConfirmado,
        valorizadoPor: userId,
        fechaValorizacion: new Date(),
        estado: 'VALORIZADO',
        actualizadoPor: userId,
      },
    })
    if (claim.count === 0) {
      const existe = await tx.reclamo.findFirst({ where: { id, eliminadoEn: null }, select: { id: true } })
      if (!existe) throw new NotFoundError('Reclamo', String(id))
      throw new ForbiddenError('El Reclamo está cerrado — no admite modificaciones (R9)')
    }

    await tx.provision.updateMany({
      where: { reclamoId: id, estado: 'VIGENTE' },
      data: { estado: 'REVERSADA', fechaReversa: new Date(), reversadoPorId: userId },
    })
    return tx.reclamo.findUniqueOrThrow({ where: { id }, include: reclamoInclude })
  })
}

// IMP-QA-R1-020: solo se puede cerrar desde VALORIZADO (antes cerraba desde
// cualquier estado no-CERRADO, saltándose la valorización obligatoria —
// R5/CA8). El claim distingue el motivo del rechazo: ya CERRADO -> 403
// (R9/CA10); todavía INGRESADO -> 422 (regla de flujo, no bloqueo por
// cierre).
export async function cerrarReclamo(id: number, procedencia: Procedencia, userId: string) {
  const claim = await prisma.reclamo.updateMany({
    where: { id, eliminadoEn: null, estado: 'VALORIZADO' },
    data: { estado: 'CERRADO', procedencia, actualizadoPor: userId },
  })
  if (claim.count === 0) {
    const actual = await prisma.reclamo.findFirst({ where: { id, eliminadoEn: null }, select: { estado: true } })
    if (!actual) throw new NotFoundError('Reclamo', String(id))
    if (actual.estado === 'CERRADO') throw new ForbiddenError('El Reclamo ya está cerrado')
    throw new ValidationError('El Reclamo debe estar Valorizado antes de cerrarse (R5)')
  }
  return getReclamoById(id)
}

export async function reabrirReclamo(id: number, userId: string) {
  const claim = await prisma.reclamo.updateMany({
    where: { id, eliminadoEn: null, estado: 'CERRADO' },
    data: { estado: 'VALORIZADO', actualizadoPor: userId },
  })
  if (claim.count === 0) {
    const existe = await prisma.reclamo.findFirst({ where: { id, eliminadoEn: null }, select: { id: true } })
    if (!existe) throw new NotFoundError('Reclamo', String(id))
    throw new ValidationError('El Reclamo no está cerrado')
  }
  return getReclamoById(id)
}

// ─── Documentos ───────────────────────────────────────────────────────────
// IMP-QA-R1-021: subir/eliminar documentos también respetan R9 ahora — antes
// no chequeaban el estado del reclamo en absoluto. `claimReclamoNoCerrado`
// bloquea la fila de Reclamo dentro de la misma transacción que la
// escritura del documento, cerrando la ventana de carrera contra un cierre
// concurrente.

export async function createDocumento(
  reclamoId: number,
  archivo: { nombre: string; mime: string; tamano: number },
  datos: Buffer,
  subidoPor: string,
) {
  return prisma.$transaction(async (tx) => {
    await claimReclamoNoCerrado(tx, reclamoId, subidoPor)
    return tx.reclamoDocumento.create({
      data: {
        reclamoId,
        nombre: archivo.nombre,
        mime: archivo.mime,
        tamano: archivo.tamano,
        subidoPor,
        contenido: { create: { datos } },
      },
      select: { id: true, nombre: true, mime: true, tamano: true, subidoEn: true, subidoPor: true },
    })
  })
}

export async function getDocumentoMeta(reclamoId: number, documentoId: number) {
  return prisma.reclamoDocumento.findFirst({
    where: { id: documentoId, reclamoId },
    select: { id: true, nombre: true, mime: true, tamano: true },
  })
}

export async function getDocumentoContenido(documentoId: number) {
  return prisma.reclamoDocumentoContenido.findUnique({ where: { documentoId } })
}

export async function deleteDocumento(reclamoId: number, documentoId: number, actualizadoPor: string) {
  await prisma.$transaction(async (tx) => {
    await claimReclamoNoCerrado(tx, reclamoId, actualizadoPor)
    await tx.reclamoDocumento.delete({ where: { id: documentoId } })
  })
}

// ─── Provisiones ──────────────────────────────────────────────────────────

// IMP-QA-R1-021: crear una Provisión también respeta R9 ahora (mismo
// `claimReclamoNoCerrado` transaccional que documentos).
export async function crearProvision(reclamoId: number, input: ProvisionInput, creadoPorId: string) {
  return prisma.$transaction(async (tx) => {
    await claimReclamoNoCerrado(tx, reclamoId, creadoPorId)
    const empresaId = getEmpresaIdActual()!
    const lineas = await tx.reclamoPalletLinea.findMany({
      where: { reclamoId },
      select: { cantidadCajas: true, palletLinea: { select: { articulo: { select: { kgNetoEnvase: true } } } } },
    })
    const totalCajas = lineas.reduce((acc, l) => acc + l.cantidadCajas, 0)
    const totalKilos = lineas.reduce((acc, l) => acc + l.cantidadCajas * Number(l.palletLinea.articulo.kgNetoEnvase ?? 0), 0)
    const { cantidadAfectada, montoCalculado } = calcularMontoProvision(input, { cajas: totalCajas, kilos: totalKilos })

    return tx.provision.create({
      data: {
        empresaId,
        reclamoId,
        tipoCalculo: input.tipoCalculo,
        valorUnitario: input.valorUnitario ?? undefined,
        cantidadAfectada: cantidadAfectada ?? undefined,
        montoFijo: input.tipoCalculo === 'MONTO_FIJO' ? input.montoFijo : undefined,
        montoCalculado,
        creadoPorId,
      },
    })
  })
}

export async function listProvisiones(reclamoId: number) {
  return prisma.provision.findMany({ where: { reclamoId }, orderBy: { fechaCreacion: 'desc' } })
}

export async function getProvisionById(id: number) {
  return prisma.provision.findUnique({ where: { id } })
}

// IMP-QA-R1-021 (persistía en ronda 2): la reversa manual no chequeaba que
// el Reclamo padre siguiera sin cerrar — mismo `claimReclamoNoCerrado`
// transaccional que documentos/análisis/provisión-crear.
export async function reversarProvision(id: number, reclamoId: number, reversadoPorId: string) {
  await prisma.$transaction(async (tx) => {
    await claimReclamoNoCerrado(tx, reclamoId, reversadoPorId)
    await tx.provision.update({
      where: { id },
      data: { estado: 'REVERSADA', fechaReversa: new Date(), reversadoPorId },
    })
  })
  return getProvisionById(id)
}
