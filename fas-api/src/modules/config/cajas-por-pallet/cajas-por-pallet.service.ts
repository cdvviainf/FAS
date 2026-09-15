import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './cajas-por-pallet.repository.js'
import type { CajasPorPalletCreateInput, CajasPorPalletUpdateInput, CajasPorPalletListFilters } from './cajas-por-pallet.types.js'

async function validarReferencias(articuloId: number, tipoPalletId: number) {
  const articulo = await repo.getArticulo(articuloId)
  if (!articulo) throw new ValidationError('El embalaje seleccionado no existe o no pertenece a esta empresa')
  if (articulo.tipo !== 'EMBALAJE') throw new ValidationError('El artículo seleccionado no es un Embalaje')
  const tipoPallet = await repo.getTipoPallet(tipoPalletId)
  if (!tipoPallet) throw new ValidationError('El tipo de pallet seleccionado no existe')
}

export async function listar(filters: CajasPorPalletListFilters) {
  const { data, total } = await repo.list(filters)
  const { page = 1, limit = 20 } = filters
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function obtener(id: number) {
  const item = await repo.getById(id)
  if (!item) throw new NotFoundError('Cajas por Pallet', String(id))
  return item
}

export async function crear(body: CajasPorPalletCreateInput, userId: string) {
  await validarReferencias(body.articuloId, body.tipoPalletId)
  const existente = await repo.findByPar(body.articuloId, body.tipoPalletId)
  if (existente) throw new ValidationError('Ya existe una cifra de cajas para ese embalaje y tipo de pallet')
  return repo.create(body, userId)
}

export async function actualizar(id: number, body: CajasPorPalletUpdateInput, userId: string) {
  const actual = await obtener(id)
  const articuloId = body.articuloId ?? actual.articuloId
  const tipoPalletId = body.tipoPalletId ?? actual.tipoPalletId
  if (body.articuloId != null || body.tipoPalletId != null) {
    await validarReferencias(articuloId, tipoPalletId)
    const existente = await repo.findByPar(articuloId, tipoPalletId, id)
    if (existente) throw new ValidationError('Ya existe una cifra de cajas para ese embalaje y tipo de pallet')
  }
  return repo.update(id, body, userId)
}

export async function eliminar(id: number, userId: string) {
  await obtener(id)
  await repo.softDelete(id, userId)
}

/** Lookup para auto-completar cajasPorPallet en OC/Instructivo/NV. */
export async function buscar(articuloId: number, tipoPalletId: number): Promise<{ cajasPorPallet: number } | null> {
  const item = await repo.findByPar(articuloId, tipoPalletId)
  return item ? { cajasPorPallet: item.cajasPorPallet } : null
}

/** Upsert validado (usado por la Carga Masiva): valida referencias y crea/actualiza. */
export async function upsertPorPar(articuloId: number, tipoPalletId: number, cajasPorPallet: number, userId: string) {
  await validarReferencias(articuloId, tipoPalletId)
  return repo.upsertPorPar(articuloId, tipoPalletId, cajasPorPallet, userId)
}
