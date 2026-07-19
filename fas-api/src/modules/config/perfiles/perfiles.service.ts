import { NotFoundError, ValidationError, ConflictError } from '../../../shared/errors.js'
import * as repo from './perfiles.repository.js'
import type { PerfilCreateInput, PerfilUpdateInput } from './perfiles.schema.js'

const SISTEMA_USER = 'system'

export async function listarPerfiles(page: number, limit: number, q?: string) {
  const { data, total } = await repo.findAllPerfiles(page, limit, q)
  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
}

export async function obtenerPerfil(id: number) {
  const perfil = await repo.findPerfilById(id)
  if (!perfil) throw new NotFoundError('Perfil', String(id))

  // Obtener todos los ítems activos y completar los faltantes como SIN_ACCESO
  const todosItems = await repo.findAllItemsMenu()
  const accesoMap = new Map(perfil.accesos.map((a) => [a.itemMenuId, a]))

  const accesoCompleto = todosItems.map((item) => {
    const acceso = accesoMap.get(item.id)
    return {
      itemMenuId: item.id,
      nivel: acceso?.nivel ?? 'SIN_ACCESO',
      itemMenu: {
        id: item.id,
        codigo: item.codigo,
        nombre: item.nombre,
        seccion: item.seccion,
        ruta: item.ruta,
        esAccion: item.esAccion,
        orden: item.orden,
      },
    }
  })

  return { ...perfil, accesos: accesoCompleto }
}

export async function crearPerfil(input: PerfilCreateInput, userId = SISTEMA_USER) {
  // RP1: codigo único entre no eliminados
  const existente = await repo.findPerfilByCodigo(input.codigo)
  if (existente) {
    throw new ValidationError(`Ya existe un perfil con código "${input.codigo}"`)
  }

  return repo.createPerfil(
    { codigo: input.codigo, descripcion: input.descripcion, creadoPor: userId },
    input.accesos ?? [],
  )
}

export async function actualizarPerfil(id: number, input: PerfilUpdateInput, userId = SISTEMA_USER) {
  const perfil = await repo.findPerfilById(id)
  if (!perfil) throw new NotFoundError('Perfil', String(id))

  // RP1: código único
  if (input.codigo && input.codigo !== perfil.codigo) {
    const existente = await repo.findPerfilByCodigo(input.codigo, id)
    if (existente) {
      throw new ValidationError(`Ya existe un perfil con código "${input.codigo}"`)
    }
  }

  return repo.updatePerfil(
    id,
    { codigo: input.codigo, descripcion: input.descripcion, actualizadoPor: userId },
    input.accesos,
  )
}

export async function eliminarPerfil(id: number, userId = SISTEMA_USER) {
  const perfil = await repo.findPerfilById(id)
  if (!perfil) throw new NotFoundError('Perfil', String(id))

  // RP5: no eliminar si tiene usuarios activos
  const countUsuarios = await repo.countUsuariosActivosByPerfilId(id)
  if (countUsuarios > 0) {
    throw new ConflictError(
      `No se puede eliminar el perfil: tiene ${countUsuarios} usuario${countUsuarios === 1 ? '' : 's'} activo${countUsuarios === 1 ? '' : 's'} asociado${countUsuarios === 1 ? '' : 's'}`,
    )
  }

  await repo.softDeletePerfil(id, userId)
}

export async function listarItemsMenu() {
  return repo.findAllItemsMenu()
}
