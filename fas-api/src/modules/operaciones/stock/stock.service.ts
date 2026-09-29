import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './stock.repository.js'
import type { StockDetalleRow, PalletUpdateInput, LoteEditarInput } from './stock.types.js'

export async function obtenerStock(): Promise<StockDetalleRow[]> {
  const pallets = await repo.listPalletsConLineas()
  const rows: StockDetalleRow[] = []
  for (const pallet of pallets) {
    for (const linea of pallet.lineas) {
      const kgNeto = linea.articulo.kgNetoEnvase != null ? Number(linea.articulo.kgNetoEnvase) : 0
      rows.push({
        palletLineaId: linea.id,
        palletId: pallet.id,
        numeroPallet: pallet.numeroPallet,
        especieId: linea.especieId,
        especie: linea.especie,
        variedadId: linea.variedadId,
        variedad: linea.variedad,
        categoriaId: linea.categoriaId,
        categoria: linea.categoria,
        calibreId: linea.calibreId,
        calibre: linea.calibre,
        productorId: pallet.productorId,
        productor: pallet.productor,
        origen: pallet.origen,
        // La Recepción que generó el Pallet nunca es RECHAZADA (una
        // Recepción rechazada no genera Pallets) — el cast es seguro.
        estado: pallet.recepcion.estado as 'CARGADA' | 'VALIDADA',
        plantaId: pallet.recepcion.plantaId,
        planta: pallet.recepcion.planta,
        fechaRecepcion: pallet.creadoEn,
        fechaEmbalaje: linea.fechaEmbalaje,
        packingId: linea.packingId,
        packing: linea.packing,
        cajas: linea.cajas,
        // Sin redondear acá (QAS-STK-004, QA ronda 2): redondear por línea
        // pierde precisión y acumula diferencia en los totales agregados —
        // el redondeo es responsabilidad de la presentación (fas-web).
        kg: linea.cajas * kgNeto,
        notaCalidadId: pallet.notaCalidadId,
        notaCalidad: pallet.notaCalidad,
        notaCondicionId: pallet.notaCondicionId,
        notaCondicion: pallet.notaCondicion,
        completo: pallet.completo,
      })
    }
  }
  return rows
}

async function validarReferencias(data: PalletUpdateInput) {
  if (data.notaCalidadId != null) {
    const nota = await repo.getNotaCalidadById(data.notaCalidadId)
    if (!nota) throw new ValidationError('La Nota de Calidad seleccionada no existe o fue eliminada')
  }
  if (data.notaCondicionId != null) {
    const nota = await repo.getNotaCondicionById(data.notaCondicionId)
    if (!nota) throw new ValidationError('La Nota de Condición seleccionada no existe o fue eliminada')
  }
}

export async function actualizarPallet(id: number, data: PalletUpdateInput) {
  const pallet = await repo.getPalletParaEdicion(id)
  if (!pallet) throw new NotFoundError('Pallet', String(id))
  await validarReferencias(data)
  return repo.updatePalletNotas(id, data)
}

// ─── Edición de Stock (2026-09-28, OPER_STOCK_EDICION) ─────────────────────

export async function obtenerLote(id: number) {
  const lote = await repo.getLoteParaEditar(id)
  if (!lote) throw new NotFoundError('Lote', String(id))
  return lote
}

// Valida existencia + coherencia de especie de todas las líneas del lote.
async function validarLineasLote(data: LoteEditarInput) {
  const especieIds = [...new Set(data.lineas.map((l) => l.especieId))]
  const variedadIds = [...new Set(data.lineas.map((l) => l.variedadId))]
  const categoriaIds = [...new Set(data.lineas.map((l) => l.categoriaId))]
  const calibreIds = [...new Set(data.lineas.map((l) => l.calibreId))]
  const articuloIds = [...new Set(data.lineas.map((l) => l.articuloId))]
  const etiquetaIds = [...new Set(data.lineas.map((l) => l.etiquetaId).filter((v): v is number => v != null))]
  const packingIds = [...new Set(data.lineas.map((l) => l.packingId).filter((v): v is number => v != null))]

  const [especies, variedades, categorias, calibres, articulos, etiquetas, packings] = await Promise.all([
    repo.getEspeciesByIds(especieIds),
    repo.getVariedadesByIds(variedadIds),
    repo.getCategoriasByIds(categoriaIds),
    repo.getCalibresByIds(calibreIds),
    repo.getArticulosByIds(articuloIds),
    etiquetaIds.length ? repo.getEtiquetasByIds(etiquetaIds) : Promise.resolve([]),
    packingIds.length ? repo.getEntidadesByIds(packingIds) : Promise.resolve([]),
  ])

  const especieSet = new Set(especies.map((e) => e.id))
  const variedadEspecie = new Map(variedades.map((v) => [v.id, v.especieId]))
  const categoriaEspecie = new Map(categorias.map((c) => [c.id, c.especieId]))
  const calibreEspecie = new Map(calibres.map((c) => [c.id, c.especieId]))
  const articuloMap = new Map(articulos.map((a) => [a.id, a]))
  const etiquetaSet = new Set(etiquetas.map((e) => e.id))
  // Packing = Entidad tipo PACKING activa (FAS-DEV-QA-R3-010) — no cualquier Entidad.
  const packingSet = new Set(packings.filter((p) => p.activo && p.tipos.includes('PACKING')).map((p) => p.id))

  data.lineas.forEach((l, i) => {
    const n = i + 1
    if (!especieSet.has(l.especieId)) throw new ValidationError(`Línea ${n}: la especie no existe o está bloqueada`)
    if (variedadEspecie.get(l.variedadId) == null) throw new ValidationError(`Línea ${n}: la variedad no existe`)
    if (variedadEspecie.get(l.variedadId) !== l.especieId) throw new ValidationError(`Línea ${n}: la variedad no pertenece a la especie`)
    if (categoriaEspecie.get(l.categoriaId) == null) throw new ValidationError(`Línea ${n}: la categoría no existe`)
    if (categoriaEspecie.get(l.categoriaId) !== l.especieId) throw new ValidationError(`Línea ${n}: la categoría no pertenece a la especie`)
    if (calibreEspecie.get(l.calibreId) == null) throw new ValidationError(`Línea ${n}: el calibre no existe`)
    if (calibreEspecie.get(l.calibreId) !== l.especieId) throw new ValidationError(`Línea ${n}: el calibre no pertenece a la especie`)
    const art = articuloMap.get(l.articuloId)
    if (!art) throw new ValidationError(`Línea ${n}: el artículo no existe`)
    if (art.tipo !== 'EMBALAJE') throw new ValidationError(`Línea ${n}: el artículo debe ser de tipo Embalaje`)
    if (!art.activo) throw new ValidationError(`Línea ${n}: el artículo está inactivo`)
    if (l.etiquetaId != null && !etiquetaSet.has(l.etiquetaId)) throw new ValidationError(`Línea ${n}: la etiqueta no existe`)
    if (l.packingId != null && !packingSet.has(l.packingId)) throw new ValidationError(`Línea ${n}: el packing no existe, está inactivo o no es tipo Packing`)
  })
}

export async function editarLote(id: number, data: LoteEditarInput) {
  const lote = await repo.getLoteParaEditar(id)
  if (!lote) throw new NotFoundError('Lote', String(id))
  // Solo se edita stock libre: bloqueado si el pallet está reservado a un
  // Embarque (o despachado — un despachado siempre tiene embarqueId).
  if (lote.embarqueId != null) {
    throw new ValidationError('No se puede editar un lote reservado a un Embarque o ya despachado')
  }

  if (data.productorId != null) {
    const [productor] = await repo.getEntidadesByIds([data.productorId])
    // Productor = Entidad tipo PRODUCTOR activa (FAS-DEV-QA-R3-010).
    if (!productor || !productor.activo || !productor.tipos.includes('PRODUCTOR')) {
      throw new ValidationError('El productor seleccionado no existe, está inactivo o no es un Productor')
    }
  }
  await validarReferencias({ notaCalidadId: data.notaCalidadId, notaCondicionId: data.notaCondicionId })
  await validarLineasLote(data)

  // `completo` siempre presente para el reclamo atómico del repo (si el body lo
  // omite, se conserva el valor actual — no es un cambio).
  return repo.editarLote(id, { ...data, completo: data.completo ?? lote.completo })
}
