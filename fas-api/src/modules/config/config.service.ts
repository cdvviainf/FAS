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
  // mercado -> pais: manejo dedicado en eliminarMantenedor (ya no es un FK
  // directo, ver MercadoPais/Fase 2b — no encaja en countChildren genérico).
  pais: [
    { childModelo: 'puerto', parentField: 'paisId', label: 'puertos' },
  ],
  tipoEmbarque: [{ childModelo: 'puerto', parentField: 'tipoEmbarqueId', label: 'puertos' }],
  comuna: [{ childModelo: 'bodega', parentField: 'comunaId', label: 'bodegas' }],
  unidadMedida: [{ childModelo: 'especie', parentField: 'unidadMedidaCalidadId', label: 'especies' }],
}

type ExternalReferenceDef = {
  delegateName:
    | 'entidad'
    | 'entidadDireccion'
    | 'bodegaContacto'
    | 'solicitudInspeccion'
    | 'solicitudInspeccionPais'
    | 'solicitudInspeccionVariedad'
    | 'solicitudInspeccionCalibre'
    | 'solicitudInspeccionCategoria'
    | 'solicitudInspeccionEmbalaje'
  parentField: string
  label: string
  usesSoftDelete?: boolean
  viaSolicitud?: boolean
}
const externalReferencesMap: Partial<Record<MantenedorModelo, ExternalReferenceDef[]>> = {
  pais: [
    { delegateName: 'entidad', parentField: 'paisId', label: 'entidades' },
    { delegateName: 'entidadDireccion', parentField: 'paisId', label: 'direcciones de entidad' },
    { delegateName: 'solicitudInspeccionPais', parentField: 'paisId', label: 'solicitudes de inspección', viaSolicitud: true },
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
  // QAS-SI-001/QAS-SI-014: maestros usados por solicitudes de inspección vigentes
  especie: [
    { delegateName: 'solicitudInspeccion', parentField: 'especieId', label: 'solicitudes de inspección' },
  ],
  temporada: [
    { delegateName: 'solicitudInspeccion', parentField: 'temporadaId', label: 'solicitudes de inspección' },
  ],
  mercado: [
    { delegateName: 'solicitudInspeccion', parentField: 'mercadoId', label: 'solicitudes de inspección' },
  ],
  variedad: [
    { delegateName: 'solicitudInspeccionVariedad', parentField: 'variedadId', label: 'solicitudes de inspección', viaSolicitud: true },
  ],
  calibre: [
    { delegateName: 'solicitudInspeccionCalibre', parentField: 'calibreId', label: 'solicitudes de inspección', viaSolicitud: true },
  ],
  categoria: [
    { delegateName: 'solicitudInspeccionCategoria', parentField: 'categoriaId', label: 'solicitudes de inspección', viaSolicitud: true },
  ],
  calificacion: [
    { delegateName: 'solicitudInspeccion', parentField: 'calificacionId', label: 'solicitudes de inspección' },
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

  // FAS-EMP-F2-R1-001: Mercado — grupoMercadoId debe pertenecer al tenant
  // activo. getMantenedorById('grupoMercado', ...) ya queda tenant-scoped por
  // la extensión de Prisma (prisma-tenancy.ts); si el grupo es de otra
  // empresa, esta consulta simplemente no lo encuentra.
  if (modelo === 'mercado' && data.grupoMercadoId) {
    const grupo = await repo.getMantenedorById('grupoMercado', data.grupoMercadoId)
    if (!grupo) throw new ValidationError('El grupo de mercado seleccionado no existe o no pertenece a esta empresa')
  }

  // Fase 2b: Pais — mercadoId debe pertenecer al tenant activo (mismo patrón
  // que Mercado/GrupoMercado arriba; Pais ya no tiene mercadoId propio, se
  // valida contra Mercado antes de upsertear MercadoPais más abajo).
  if (modelo === 'pais' && data.mercadoId) {
    const mercado = await repo.getMantenedorById('mercado', data.mercadoId)
    if (!mercado) throw new ValidationError('El mercado seleccionado no existe o no pertenece a esta empresa')
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

  // Fase 2b: mercadoId de Pais no es una columna propia — se extrae acá y se
  // resuelve aparte (MercadoPais) después de crear el país.
  const { contactos, mercadoId, ...coreData } = data as MantenedorCreateInput & {
    contactos?: import('./config.types.js').BodegaContactoInput[]
  }

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

  if (modelo === 'pais' && mercadoId != null) {
    await repo.upsertMercadoPais(created.id, mercadoId, userId)
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
    if (targetEspecieId) {
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

  // FAS-EMP-F2-R1-001: Mercado — grupoMercadoId debe pertenecer al tenant activo (on update)
  if (modelo === 'mercado' && data.grupoMercadoId !== undefined) {
    const grupo = await repo.getMantenedorById('grupoMercado', data.grupoMercadoId)
    if (!grupo) throw new ValidationError('El grupo de mercado seleccionado no existe o no pertenece a esta empresa')
  }

  // Fase 2b: Pais — mercadoId debe pertenecer al tenant activo (on update)
  if (modelo === 'pais' && data.mercadoId !== undefined && data.mercadoId !== null) {
    const mercado = await repo.getMantenedorById('mercado', data.mercadoId)
    if (!mercado) throw new ValidationError('El mercado seleccionado no existe o no pertenece a esta empresa')
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

  const { contactos, mercadoId, ...coreData } = data as Partial<MantenedorCreateInput> & {
    contactos?: import('./config.types.js').BodegaContactoInput[]
  }

  // Temporada: convertir strings YYYY-MM-DD a Date para Prisma DateTime
  if (modelo === 'temporada') {
    if ((coreData as AnyRecord).fechaInicio) (coreData as AnyRecord).fechaInicio = new Date((coreData as AnyRecord).fechaInicio)
    if ((coreData as AnyRecord).fechaTermino) (coreData as AnyRecord).fechaTermino = new Date((coreData as AnyRecord).fechaTermino)
  }

  if (modelo === 'bodega' && contactos !== undefined) {
    // Transacción atómica: update bodega + replace contactos
    return repo.updateBodegaConContactos(id, coreData, contactos, userId)
  }

  const updated = await repo.updateMantenedor(modelo, id, coreData, userId)

  if (modelo === 'pais') {
    if (mercadoId !== undefined && mercadoId !== null) {
      await repo.upsertMercadoPais(id, mercadoId, userId)
    }
    // Siempre re-consultar (aunque este PATCH no haya tocado mercadoId): el
    // contrato de respuesta de Pais incluye mercadoId/mercado reconstruidos
    // vía MercadoPais (aplanarMercado), que `updated` (registro Prisma crudo)
    // no tiene.
    return repo.getMantenedorById(modelo, id)
  }

  return updated
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

  // Fase 2b: Mercado -> Pais ya no es un FK directo (ver MercadoPais) — no
  // encaja en el countChildren genérico de abajo (que asume [parentField]:
  // parentId sobre el propio modelo hijo).
  if (modelo === 'mercado') {
    const count = await repo.countPaisesPorMercado(id)
    if (count > 0) {
      throw new ConflictError(
        `No se puede eliminar: tiene ${count} país${count === 1 ? '' : 'es'} vigente${count === 1 ? '' : 's'} asociado${count === 1 ? '' : 's'}. Para dar de baja este registro, inactívalo (bloquéalo) en lugar de eliminarlo.`,
      )
    }
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
      reference.viaSolicitud,
    )
    if (count > 0) {
      throw new ConflictError(
        `No se puede eliminar: tiene ${count} ${reference.label} vigente${count === 1 ? '' : 's'} asociado${count === 1 ? '' : 's'}. Para dar de baja este registro, inactívalo (bloquéalo) en lugar de eliminarlo.`,
      )
    }
  }

  await repo.softDeleteMantenedor(modelo, id, userId)
}
