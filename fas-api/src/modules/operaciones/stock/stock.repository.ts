import { prisma } from '../../../lib/prisma.js'
import { ValidationError } from '../../../shared/errors.js'
import type { LoteEditarInput, PalletUpdateInput } from './stock.types.js'

const entidadSelect = { id: true, codigo: true, descripcion: true }
const mantenedorSelect = { id: true, codigo: true, descripcion: true }

// Pallets vigentes de la empresa que siguen siendo stock DISPONIBLE (modelo
// tenant — el Prisma Client Extension inyecta empresaId) con sus líneas y los
// datos necesarios para resolver especie/variedad/categoría/calibre/
// productor/estado/kg. `embarqueId: null` (2026-09-02, EP-QA-005): un pallet
// ya reservado a un Embarque dejó de ser stock disponible — compras.md §11
// describe este reporte como "stock disponible", no "todo lo recepcionado
// alguna vez". Sin más filtros: el reporte en pantalla (fas-web) trae este
// dataset completo una sola vez y filtra/agrupa/pagina en el cliente
// (2026-08-24, ver compras.md §11 y stock.types.ts).
export async function listPalletsConLineas() {
  return prisma.pallet.findMany({
    where: { embarqueId: null },
    include: {
      productor: { select: entidadSelect },
      recepcion: { select: { estado: true, plantaId: true, planta: { select: entidadSelect } } },
      notaCalidad: { select: mantenedorSelect },
      notaCondicion: { select: mantenedorSelect },
      lineas: {
        include: {
          especie: { select: mantenedorSelect },
          variedad: { select: mantenedorSelect },
          categoria: { select: mantenedorSelect },
          // orden: para graficar la distribución de calibres respetando el
          // orden del maestro (por especie), no el orden alfabético.
          calibre: { select: { ...mantenedorSelect, orden: true } },
          // id/codigo/descripcion (2026-09-30): nivel de agrupador "Artículo"
          // (Embalaje) en el reporte de Stock, entre Especie y Variedad.
          articulo: { select: { ...mantenedorSelect, kgNetoEnvase: true } },
          packing: { select: entidadSelect },
        },
      },
    },
    orderBy: { creadoEn: 'desc' },
  })
}

// Calificación de Pallets (2026-09-02, compras.md §4.8): solo valida existencia
// — la restricción del selector de Nota Calidad/Condición por especie es
// client-side (decisión del usuario, sin validación dura en backend).
export async function getPalletParaEdicion(id: number) {
  return prisma.pallet.findFirst({
    where: { id },
    select: { id: true },
  })
}

export async function updatePalletNotas(id: number, data: PalletUpdateInput) {
  return prisma.pallet.update({
    where: { id },
    data,
    include: {
      notaCalidad: { select: mantenedorSelect },
      notaCondicion: { select: mantenedorSelect },
    },
  })
}

export async function getNotaCalidadById(id: number) {
  return prisma.notaCalidad.findFirst({ where: { id, eliminadoEn: null } })
}

export async function getNotaCondicionById(id: number) {
  return prisma.notaCondicion.findFirst({ where: { id, eliminadoEn: null } })
}

// ─── Edición de Stock (2026-09-28, OPER_STOCK_EDICION) ─────────────────────

// Lote (pallet + líneas) con todos los campos editables — para el guard de
// "libre" (embarqueId) y para el formulario de edición.
export async function getLoteParaEditar(id: number) {
  return prisma.pallet.findFirst({
    where: { id },
    select: {
      id: true,
      numeroPallet: true,
      embarqueId: true,
      productorId: true,
      notaCalidadId: true,
      notaCondicionId: true,
      completo: true,
      lineas: {
        select: {
          id: true,
          especieId: true,
          variedadId: true,
          categoriaId: true,
          articuloId: true,
          calibreId: true,
          cajas: true,
          fechaEmbalaje: true,
          etiquetaId: true,
          packingId: true,
        },
        orderBy: { id: 'asc' },
      },
    },
  })
}

// Lookups de validación (bulk) — existencia + coherencia de especie.
export async function getVariedadesByIds(ids: number[]) {
  return prisma.variedad.findMany({ where: { id: { in: ids }, eliminadoEn: null }, select: { id: true, especieId: true } })
}
export async function getCategoriasByIds(ids: number[]) {
  return prisma.categoria.findMany({ where: { id: { in: ids }, eliminadoEn: null }, select: { id: true, especieId: true } })
}
export async function getCalibresByIds(ids: number[]) {
  return prisma.calibre.findMany({ where: { id: { in: ids }, eliminadoEn: null }, select: { id: true, especieId: true } })
}
export async function getEspeciesByIds(ids: number[]) {
  return prisma.especie.findMany({ where: { id: { in: ids }, eliminadoEn: null }, select: { id: true } })
}
export async function getArticulosByIds(ids: number[]) {
  return prisma.articulo.findMany({ where: { id: { in: ids } }, select: { id: true, tipo: true, activo: true } })
}
export async function getEntidadesByIds(ids: number[]) {
  return prisma.entidad.findMany({ where: { id: { in: ids }, eliminadoEn: null }, select: { id: true, tipos: true, activo: true } })
}
export async function getEtiquetasByIds(ids: number[]) {
  return prisma.etiqueta.findMany({ where: { id: { in: ids }, eliminadoEn: null }, select: { id: true } })
}

// Reemplaza el lote (pallet + líneas) en una transacción. Las líneas con `id`
// existente se actualizan; las existentes ausentes del payload se eliminan; las
// sin `id` se crean.
//
// Integridad concurrente (FAS-DEV-QA-R1-003): el reclamo del pallet es atómico —
// el updateMany condicionado a `embarqueId: null` toma el lock de la fila y
// verifica que siga libre en un solo paso; si una reserva concurrente lo tomó
// primero, cuenta 0 y se aborta toda la transacción (líneas incluidas).
// Integridad de líneas (FAS-DEV-QA-R1-004): cada `id` enviado debe pertenecer al
// pallet y no repetirse; cada update debe afectar exactamente una fila.
export async function editarLote(id: number, data: LoteEditarInput) {
  // Las escrituras van en la transacción; la relectura de la respuesta se hace
  // DESPUÉS del commit (FAS-DEV-QA-R2-008) — leer con el cliente global dentro
  // de la tx no vería las escrituras aún no confirmadas y devolvería el lote
  // previo. Mismo criterio que confirmarDespacho en embarques.repository.ts.
  await prisma.$transaction(async (tx) => {
    // Reclamo atómico: solo procede si el pallet sigue libre. `completo` siempre
    // viene (el service lo completa con el valor actual si el body lo omite), así
    // que el `data` del updateMany nunca queda vacío.
    const claim = await tx.pallet.updateMany({
      where: { id, embarqueId: null },
      data: {
        ...(data.productorId !== undefined ? { productorId: data.productorId } : {}),
        ...(data.notaCalidadId !== undefined ? { notaCalidadId: data.notaCalidadId } : {}),
        ...(data.notaCondicionId !== undefined ? { notaCondicionId: data.notaCondicionId } : {}),
        completo: data.completo,
      },
    })
    if (claim.count === 0) {
      throw new ValidationError('El lote fue reservado a un Embarque mientras se editaba — recarga e intenta de nuevo')
    }

    const existentes = await tx.palletLinea.findMany({ where: { palletId: id }, select: { id: true } })
    const existentesSet = new Set(existentes.map((e) => e.id))
    const idsConId = data.lineas.filter((l) => l.id != null).map((l) => l.id!)
    // Cada id enviado debe pertenecer al pallet y no repetirse.
    const vistos = new Set<number>()
    for (const lid of idsConId) {
      if (!existentesSet.has(lid)) throw new ValidationError('Una de las líneas no pertenece a este lote — recarga e intenta de nuevo')
      if (vistos.has(lid)) throw new ValidationError('Hay una línea repetida en el lote')
      vistos.add(lid)
    }

    const idsPayload = new Set(idsConId)
    const aEliminar = existentes.filter((e) => !idsPayload.has(e.id)).map((e) => e.id)
    if (aEliminar.length > 0) {
      await tx.palletLinea.deleteMany({ where: { id: { in: aEliminar }, palletId: id } })
    }

    for (const l of data.lineas) {
      const datos = {
        especieId: l.especieId,
        variedadId: l.variedadId,
        categoriaId: l.categoriaId,
        articuloId: l.articuloId,
        calibreId: l.calibreId,
        cajas: l.cajas,
        fechaEmbalaje: l.fechaEmbalaje ?? null,
        etiquetaId: l.etiquetaId ?? null,
        packingId: l.packingId ?? null,
      }
      if (l.id != null) {
        const upd = await tx.palletLinea.updateMany({ where: { id: l.id, palletId: id }, data: datos })
        if (upd.count !== 1) throw new ValidationError('No se pudo actualizar una de las líneas del lote — recarga e intenta de nuevo')
      } else {
        await tx.palletLinea.create({ data: { palletId: id, ...datos } })
      }
    }
  })
  return getLoteParaEditar(id)
}
