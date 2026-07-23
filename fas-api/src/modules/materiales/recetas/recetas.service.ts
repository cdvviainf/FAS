import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './recetas.repository.js'
import type { RecetaCreateInput, RecetaUpdateInput } from './recetas.types.js'

const COMPONENTES_VALIDOS = new Set(['MATERIAL_EMBALAJE', 'SERVICIO'])

async function validarEmbalaje(embalajeId: number) {
  const articulo = await repo.getArticuloTipo(embalajeId)
  if (!articulo) throw new ValidationError('El embalaje seleccionado no existe')
  if (articulo.tipo !== 'EMBALAJE') {
    throw new ValidationError('La cabecera de la receta solo puede ser un artículo de tipo Embalaje (R13)')
  }
}

async function validarComponentes(componenteIds: number[]) {
  const articulos = await repo.getArticulosTipos(componenteIds)
  if (articulos.length !== componenteIds.length) {
    throw new ValidationError('Uno o más componentes de la receta no existen')
  }
  const invalidos = articulos.filter((a) => !COMPONENTES_VALIDOS.has(a.tipo))
  if (invalidos.length > 0) {
    throw new ValidationError(
      `Los componentes de receta solo pueden ser Material de Embalaje o Servicio (R13). Inválidos: ${invalidos.map((a) => a.id).join(', ')}`,
    )
  }
}

export async function listarRecetasPorEmbalaje(embalajeId: number) {
  return repo.listRecetasPorEmbalaje(embalajeId)
}

export async function obtenerReceta(id: number) {
  const receta = await repo.getRecetaById(id)
  if (!receta) throw new NotFoundError('Receta', String(id))
  return receta
}

export async function crearReceta(body: RecetaCreateInput) {
  const existente = await repo.findRecetaByCodigo(body.codigo)
  if (existente) throw new ValidationError(`Ya existe una receta con código "${body.codigo}"`)

  await validarEmbalaje(body.embalajeId)
  await validarComponentes(body.detalle.map((d) => d.componenteId))

  return repo.createReceta(body)
}

export async function actualizarReceta(id: number, body: RecetaUpdateInput) {
  await obtenerReceta(id)
  if (body.detalle !== undefined) {
    await validarComponentes(body.detalle.map((d) => d.componenteId))
  }
  return repo.updateReceta(id, body)
}
