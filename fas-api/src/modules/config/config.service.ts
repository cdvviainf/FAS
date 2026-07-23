import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors.js'
import * as repo from './config.repository.js'
import type { MantenedorModelo, MantenedorListFilters, MantenedorCreateInput } from './config.types.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

const SISTEMA_USER = 'sistema' // temporal hasta tener auth real

// Models with child relations for R8 (softdelete parent check)
type ChildDef = { childModelo: MantenedorModelo; parentField: string; label: string }
const childrenMap: Partial<Record<MantenedorModelo, ChildDef[]>> = {
  region: [{ childModelo: 'provincia', parentField: 'regionId', label: 'provincias' }],
  provincia: [{ childModelo: 'comuna', parentField: 'provinciaId', label: 'comunas' }],
  especie: [
    { childModelo: 'grupoVariedad', parentField: 'especieId', label: 'grupos de variedad' },
    { childModelo: 'variedad', parentField: 'especieId', label: 'variedades' },
    { childModelo: 'categoria', parentField: 'especieId', label: 'categorías' },
    { childModelo: 'calibre', parentField: 'especieId', label: 'calibres' },
  ],
  grupoVariedad: [{ childModelo: 'variedad', parentField: 'grupoVariedadId', label: 'variedades' }],
  tipoParametro: [{ childModelo: 'parametro', parentField: 'tipoParametroId', label: 'parámetros' }],
  grupoMercado: [{ childModelo: 'mercado', parentField: 'grupoMercadoId', label: 'mercados' }],
  pais: [
    { childModelo: 'mercado', parentField: 'paisId', label: 'mercados' },
    { childModelo: 'puerto', parentField: 'paisId', label: 'puertos' },
  ],
  tipoEmbarque: [{ childModelo: 'puerto', parentField: 'tipoEmbarqueId', label: 'puertos' }],
  comuna: [{ childModelo: 'bodega', parentField: 'comunaId', label: 'bodegas' }],
  unidadMedida: [{ childModelo: 'especie', parentField: 'unidadMedidaCalidadId', label: 'especies' }],
}

type ExternalReferenceDef = {
  delegateName: 'entidad' | 'entidadDireccion' | 'bodegaContacto' | 'solicitudInspeccion'
  parentField: string
  label: string
  usesSoftDelete?: boolean
}
const externalReferencesMap: Partial<Record<MantenedorModelo, ExternalReferenceDef[]>> = {
  pais: [
    { delegateName: 'entidad', parentField: 'paisId', label: 'entidades' },
    { delegateName: 'entidadDireccion', parentField: 'paisId', label: 'direcciones de entidad' },
  ],
  comuna: [
    { delegateName: 'entidadDireccion', parentField: 'comunaId', label: 'direcciones de entidad' },
  ],
  bodega: [
    {
      delegateName: 'bodegaContacto',
      parentField: 'bodegaId',
      label: 'contactos de bodega',
      usesSoftDelete: false,
    },
  ],
  // QAS-SI-001: maestros usados por solicitudes de inspección vigentes
  especie: [
    { delegateName: 'solicitudInspeccion', parentField: 'especieId', label: 'solicitudes de inspección' },
  ],
  temporada: [
    { delegateName: 'solicitudInspeccion', parentField: 'temporadaId', label: 'solicitudes de inspección' },
  ],
  motivoInspeccion: [
    { delegateName: 'solicitudInspeccion', parentField: 'motivoId', label: 'solicitudes de inspección' },
  ],
}

export async function obtenerTemporadaPredeterminada() {
  return repo.getTemporadaPredeterminada()
}

export async function listarMantenedor(modelo: MantenedorModelo, filters: MantenedorListFilters) {
  const { data, total } = await repo.listMantenedor(modelo, filters)
  const { page = 1, limit = 20 } = filters
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function obtenerMantenedor(modelo: MantenedorModelo, id: number) {
  const item = await repo.getMantenedorById(modelo, id)
  if (!item) throw new NotFoundError(modelo, String(id))
  return item
}

export async function crearMantenedor(
  modelo: MantenedorModelo,
  data: MantenedorCreateInput,
  userId = SISTEMA_USER,
) {
  const existente = await repo.findMantenedorByCodigo(modelo, data.codigo)
  if (existente) throw new ValidationError(`Ya existe un registro con código "${data.codigo}"`)

  // R6/R7: unique (especieId, orden) for Categoria and Calibre
  if ((modelo === 'categoria' || modelo === 'calibre') && data.especieId && data.orden !== undefined) {
    const existeOrden = await repo.findMantenedorByOrden(modelo, data.especieId, data.orden)
    if (existeOrden) {
      throw new ValidationError(`Ya existe un registro con orden ${data.orden} para esta especie`)
    }
  }

  // L2-09: Variedad — grupoVariedadId must belong to same especieId
  if (modelo === 'variedad' && data.grupoVariedadId && data.especieId) {
    const grupo = await repo.getMantenedorById('grupoVariedad', data.grupoVariedadId) as { especieId?: number } | null
    if (!grupo) throw new ValidationError(`El grupo de variedad no existe`)
    if (grupo.especieId !== data.especieId) {
      throw new ValidationError(`El grupo de variedad no pertenece a la especie seleccionada`)
    }
  }

  // QAS-MG-L3-006: Puerto — validate active FKs
  if (modelo === 'puerto') {
    if (data.paisId) {
      const pais = await repo.getMantenedorById('pais', data.paisId)
      if (!pais) throw new ValidationError('El país seleccionado no existe o fue eliminado')
    }
    if (data.tipoEmbarqueId) {
      const embarque = await repo.getMantenedorById('tipoEmbarque', data.tipoEmbarqueId)
      if (!embarque) throw new ValidationError('El tipo de embarque seleccionado no existe o fue eliminado')
    }
  }

  // QAS-MG-L4-004: Bodega — validate active FK comunaId
  if (modelo === 'bodega' && data.comunaId) {
    const comuna = await repo.getMantenedorById('comuna', data.comunaId)
    if (!comuna) throw new ValidationError('La comuna seleccionada no existe o fue eliminada')
  }

  // Especie — validate active FK unidadMedidaCalidadId
  if (modelo === 'especie' && data.unidadMedidaCalidadId != null) {
    const um = await repo.getMantenedorById('unidadMedida', data.unidadMedidaCalidadId)
    if (!um) throw new ValidationError('La unidad de medida de calidad no existe o fue eliminada')
  }

  // R4: Temporada — rangos no se solapan
  if (modelo === 'temporada' && data.fechaInicio && data.fechaTermino) {
    const overlap = await repo.findTemporadaOverlap(
      new Date(data.fechaInicio),
      new Date(data.fechaTermino),
    )
    if (overlap) {
      const inicio = (overlap as AnyRecord).fechaInicio.toISOString().slice(0, 10)
      const termino = (overlap as AnyRecord).fechaTermino.toISOString().slice(0, 10)
      throw new ValidationError(
        `El rango se solapa con la temporada "${(overlap as AnyRecord).descripcion}" (${inicio} – ${termino})`,
      )
    }
  }

  // R5: Moneda base única — al crear con esMonedaBase=true, se desmarcan las demás
  if (modelo === 'moneda' && data.esMonedaBase) {
    await repo.clearMonedaBase()
  }

  // Temporada predeterminada — siempre debe existir una: si no hay ninguna activa,
  // esta se marca como predeterminada sin importar lo enviado por el cliente.
  if (modelo === 'temporada') {
    const existePredeterminada = await repo.countTemporadaPredeterminada()
    if (existePredeterminada === 0) {
      ;(data as AnyRecord).predeterminada = true
    }
    if (data.predeterminada) {
      await repo.clearTemporadaPredeterminada()
    }
  }

  const { contactos, ...coreData } = data as MantenedorCreateInput & { contactos?: import('./config.types.js').BodegaContactoInput[] }

  // Temporada: convertir strings YYYY-MM-DD a Date para Prisma DateTime
  if (modelo === 'temporada') {
    if ((coreData as AnyRecord).fechaInicio) (coreData as AnyRecord).fechaInicio = new Date((coreData as AnyRecord).fechaInicio)
    if ((coreData as AnyRecord).fechaTermino) (coreData as AnyRecord).fechaTermino = new Date((coreData as AnyRecord).fechaTermino)
  }

  const created = await repo.createMantenedor(modelo, coreData, userId)

  if (modelo === 'bodega' && contactos && contactos.length > 0) {
    await repo.createBodegaContactos(created.id, contactos)
    return repo.getMantenedorById(modelo, created.id)
  }

  return created
}

export async function actualizarMantenedor(
  modelo: MantenedorModelo,
  id: number,
  data: Partial<MantenedorCreateInput>,
  userId = SISTEMA_USER,
) {
  await obtenerMantenedor(modelo, id)

  // R6/R7: unique (especieId, orden) for Categoria and Calibre on update
  if ((modelo === 'categoria' || modelo === 'calibre') && data.orden !== undefined) {
    const current = await repo.getMantenedorById(modelo, id)
    const especieId = data.especieId ?? current?.especieId
    if (especieId) {
      const existeOrden = await repo.findMantenedorByOrden(modelo, especieId, data.orden, id)
      if (existeOrden) {
        throw new ValidationError(`Ya existe un registro con orden ${data.orden} para esta especie`)
      }
    }
  }

  // L2-09: Variedad — grupoVariedadId must belong to same especieId (on update)
  if (modelo === 'variedad' && data.grupoVariedadId !== undefined) {
    const current = await repo.getMantenedorById(modelo, id) as { especieId?: number } | null
    const targetEspecieId = data.especieId ?? current?.especieId
    if (data.grupoVariedadId !== null && targetEspecieId) {
      const grupo = await repo.getMantenedorById('grupoVariedad', data.grupoVariedadId) as { especieId?: number } | null
      if (!grupo) throw new ValidationError(`El grupo de variedad no existe`)
      if (grupo.especieId !== targetEspecieId) {
        throw new ValidationError(`El grupo de variedad no pertenece a la especie seleccionada`)
      }
    }
  }

  // QAS-MG-L3-006: Puerto — validate active FKs on update
  if (modelo === 'puerto') {
    if (data.paisId !== undefined) {
      const pais = await repo.getMantenedorById('pais', data.paisId)
      if (!pais) throw new ValidationError('El país seleccionado no existe o fue eliminado')
    }
    if (data.tipoEmbarqueId !== undefined) {
      const embarque = await repo.getMantenedorById('tipoEmbarque', data.tipoEmbarqueId)
      if (!embarque) throw new ValidationError('El tipo de embarque seleccionado no existe o fue eliminado')
    }
  }

  // QAS-MG-L4-004: Bodega — validate active FK comunaId on update
  if (modelo === 'bodega' && data.comunaId !== undefined) {
    const comuna = await repo.getMantenedorById('comuna', data.comunaId)
    if (!comuna) throw new ValidationError('La comuna seleccionada no existe o fue eliminada')
  }

  // Especie — validate active FK unidadMedidaCalidadId on update
  if (modelo === 'especie' && data.unidadMedidaCalidadId !== undefined && data.unidadMedidaCalidadId !== null) {
    const um = await repo.getMantenedorById('unidadMedida', data.unidadMedidaCalidadId)
    if (!um) throw new ValidationError('La unidad de medida de calidad no existe o fue eliminada')
  }

  // R4: Temporada — rangos no se solapan (on update)
  if (modelo === 'temporada') {
    const current = await repo.getMantenedorById(modelo, id) as AnyRecord | null
    const fechaInicio = data.fechaInicio ?? current?.fechaInicio
    const fechaTermino = data.fechaTermino ?? current?.fechaTermino
    if (fechaInicio && fechaTermino) {
      const overlap = await repo.findTemporadaOverlap(
        new Date(fechaInicio),
        new Date(fechaTermino),
        id,
      )
      if (overlap) {
        const inicio = (overlap as AnyRecord).fechaInicio.toISOString().slice(0, 10)
        const termino = (overlap as AnyRecord).fechaTermino.toISOString().slice(0, 10)
        throw new ValidationError(
          `El rango se solapa con la temporada "${(overlap as AnyRecord).descripcion}" (${inicio} – ${termino})`,
        )
      }
    }
  }

  // R5: Moneda base — enforce "exactly one"
  if (modelo === 'moneda') {
    if (data.esMonedaBase) {
      // Marking as base: clear others
      await repo.clearMonedaBase(id)
    } else if (data.esMonedaBase === false) {
      // Un-marking: ensure another base will remain
      const current = await repo.getMantenedorById(modelo, id) as AnyRecord | null
      if (current?.esMonedaBase) {
        const otherBaseCount = await repo.countMonedaBase(id)
        if (otherBaseCount === 0) {
          throw new ValidationError('No se puede desmarcar la moneda base: designa otra moneda como base primero')
        }
      }
    }
  }

  // Temporada predeterminada — solo una
  if (modelo === 'temporada') {
    if (data.predeterminada) {
      await repo.clearTemporadaPredeterminada(id)
    } else if (data.predeterminada === false) {
      const current = await repo.getMantenedorById(modelo, id) as AnyRecord | null
      if (current?.predeterminada) {
        const otherCount = await repo.countTemporadaPredeterminada(id)
        if (otherCount === 0) {
          throw new ValidationError('No se puede desmarcar la temporada predeterminada: designa otra como predeterminada primero')
        }
      }
    }
  }

  const { contactos, ...coreData } = data as Partial<MantenedorCreateInput> & { contactos?: import('./config.types.js').BodegaContactoInput[] }

  // Temporada: convertir strings YYYY-MM-DD a Date para Prisma DateTime
  if (modelo === 'temporada') {
    if ((coreData as AnyRecord).fechaInicio) (coreData as AnyRecord).fechaInicio = new Date((coreData as AnyRecord).fechaInicio)
    if ((coreData as AnyRecord).fechaTermino) (coreData as AnyRecord).fechaTermino = new Date((coreData as AnyRecord).fechaTermino)
  }

  if (modelo === 'bodega' && contactos !== undefined) {
    // Transacción atómica: update bodega + replace contactos
    return repo.updateBodegaConContactos(id, coreData, contactos, userId)
  }

  return repo.updateMantenedor(modelo, id, coreData, userId)
}

export async function eliminarMantenedor(
  modelo: MantenedorModelo,
  id: number,
  userId = SISTEMA_USER,
) {
  const item = await obtenerMantenedor(modelo, id)

  // R5: Cannot delete the base moneda
  if (modelo === 'moneda' && (item as AnyRecord).esMonedaBase) {
    throw new ConflictError('No se puede eliminar la moneda base: designa otra moneda como base primero')
  }

  // Cannot delete the predeterminada temporada
  if (modelo === 'temporada' && (item as AnyRecord).predeterminada) {
    throw new ConflictError('No se puede eliminar la temporada predeterminada: designa otra como predeterminada primero')
  }

  // R8: check children before softdelete
  const childDefs = childrenMap[modelo] ?? []
  for (const child of childDefs) {
    const count = await repo.countChildren(child.childModelo, id, child.parentField)
    if (count > 0) {
      throw new ConflictError(
        `No se puede eliminar: tiene ${count} ${child.label} vigente${count === 1 ? '' : 's'} asociado${count === 1 ? '' : 's'}. Para dar de baja este registro, inactívalo (bloquéalo) en lugar de eliminarlo.`,
      )
    }
  }

  const externalReferences = externalReferencesMap[modelo] ?? []
  for (const reference of externalReferences) {
    const count = await repo.countActiveReferences(
      reference.delegateName,
      id,
      reference.parentField,
      reference.usesSoftDelete,
    )
    if (count > 0) {
      throw new ConflictError(
        `No se puede eliminar: tiene ${count} ${reference.label} vigente${count === 1 ? '' : 's'} asociado${count === 1 ? '' : 's'}. Para dar de baja este registro, inactívalo (bloquéalo) en lugar de eliminarlo.`,
      )
    }
  }

  await repo.softDeleteMantenedor(modelo, id, userId)
}
