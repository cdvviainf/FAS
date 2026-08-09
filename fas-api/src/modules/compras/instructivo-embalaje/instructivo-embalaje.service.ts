import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './instructivo-embalaje.repository.js'
import type { InstructivoEmbalajeCreateInput, InstructivoEmbalajeDetalleInput } from './instructivo-embalaje.types.js'

async function validarLinea(linea: InstructivoEmbalajeDetalleInput, index: number) {
  const prefijo = `Línea ${index + 1}:`

  const especie = await repo.getEspecie(linea.especieId)
  if (!especie) throw new ValidationError(`${prefijo} la especie seleccionada no existe o está bloqueada`)

  const articulo = await repo.getArticuloTipo(linea.articuloId)
  if (!articulo) throw new ValidationError(`${prefijo} el artículo de embalaje seleccionado no existe`)
  if (articulo.tipo !== 'EMBALAJE') {
    throw new ValidationError(`${prefijo} el artículo debe ser de tipo Embalaje`)
  }
  if (!articulo.activo) throw new ValidationError(`${prefijo} el artículo de embalaje seleccionado está inactivo`)

  const variedad = await repo.getVariedad(linea.variedadId)
  if (!variedad) throw new ValidationError(`${prefijo} la variedad seleccionada no existe o está bloqueada`)
  if (variedad.especieId !== linea.especieId) {
    throw new ValidationError(`${prefijo} la variedad no pertenece a la especie seleccionada`)
  }

  const categoria = await repo.getCategoria(linea.categoriaId)
  if (!categoria) throw new ValidationError(`${prefijo} la categoría seleccionada no existe o está bloqueada`)
  if (categoria.especieId !== linea.especieId) {
    throw new ValidationError(`${prefijo} la categoría no pertenece a la especie seleccionada`)
  }

  const calibres = await repo.getCalibresActivos(linea.calibreIds)
  if (calibres.length !== new Set(linea.calibreIds).size) {
    throw new ValidationError(`${prefijo} uno o más calibres seleccionados no existen o están bloqueados`)
  }
  if (calibres.some((c) => c.especieId !== linea.especieId)) {
    throw new ValidationError(`${prefijo} uno o más calibres no pertenecen a la especie seleccionada`)
  }

  if (linea.tipoPalletId != null) {
    const tipoPallet = await repo.getTipoPallet(linea.tipoPalletId)
    if (!tipoPallet) throw new ValidationError(`${prefijo} el tipo de pallet seleccionado no existe o está bloqueado`)
  }
}

export async function listarInstructivos(page: number, limit: number, notaVentaId?: number) {
  const { data, total } = await repo.listInstructivos(page, limit, notaVentaId)
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function obtenerInstructivo(id: number) {
  const instructivo = await repo.getInstructivoById(id)
  if (!instructivo) throw new NotFoundError('Instructivo de Embalaje', String(id))
  return instructivo
}

export async function crearInstructivo(body: InstructivoEmbalajeCreateInput, creadoPor: string) {
  const notaVenta = await repo.getNotaVenta(body.notaVentaId)
  if (!notaVenta) throw new ValidationError('El Cierre Comercial (Nota de Venta) seleccionado no existe')

  for (const [index, linea] of body.detalle.entries()) {
    await validarLinea(linea, index)
  }

  return repo.createInstructivo(body.notaVentaId, body.detalle, creadoPor)
}
