import { NotFoundError, ValidationError, ConflictError } from '../../../shared/errors.js'
import { validarRutChileno } from '../../../shared/rut-validator.js'
import * as repo from './entidades.repository.js'
import type {
  EntidadCreateInput,
  EntidadUpdateInput,
  DireccionCreateInput,
  DireccionUpdateInput,
  ContactoCreateInput,
  ContactoUpdateInput,
} from './entidades.schema.js'
import type { TipoEntidad } from '@prisma/client'

// ─── Entidades ────────────────────────────────────────────────────────────────

export async function listarEntidades(
  page: number,
  limit: number,
  q?: string,
  tipo?: TipoEntidad,
  activo?: boolean,
) {
  const { data, total } = await repo.findAllEntidades(page, limit, q, tipo, activo)
  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
}

export async function obtenerEntidad(id: number) {
  const entidad = await repo.findEntidadById(id)
  if (!entidad) throw new NotFoundError('Entidad', String(id))
  return entidad
}

export async function crearEntidad(input: EntidadCreateInput, userId: string) {
  // R1: tipos.length >= 1 (ya validado por Zod, pero reforzamos)
  if (input.tipos.length < 1) {
    throw new ValidationError('Debe especificar al menos un tipo de entidad')
  }

  // R2: codigo único entre no eliminados
  const existenteCodigo = await repo.findEntidadByCodigo(input.codigo)
  if (existenteCodigo) {
    throw new ValidationError(`Ya existe una entidad con código "${input.codigo}"`)
  }

  // Validar país
  const pais = await repo.findPaisById(input.paisId)
  if (!pais) throw new NotFoundError('País', String(input.paisId))

  // R3: si país es Chile y hay identificador → validar DV
  if (input.identificador) {
    if (pais.esPaisOrigen) {
      if (!validarRutChileno(input.identificador)) {
        throw new ValidationError(
          `El identificador "${input.identificador}" no es un RUT chileno válido`,
        )
      }
    }
    // Unicidad de identificador entre no eliminados
    const existenteId = await repo.findEntidadByIdentificador(input.identificador)
    if (existenteId) {
      throw new ValidationError(
        `Ya existe una entidad con identificador "${input.identificador}"`,
      )
    }
  }

  // Giro obligatorio si el país es Chile
  if (pais.esPaisOrigen && !input.giro) {
    throw new ValidationError('El giro es obligatorio para entidades nacionales (Chile)')
  }

  return repo.createEntidad(input, userId)
}

export async function actualizarEntidad(
  id: number,
  input: EntidadUpdateInput,
  userId: string,
) {
  const entidad = await repo.findEntidadById(id)
  if (!entidad) throw new NotFoundError('Entidad', String(id))

  // R1: tipos
  if (input.tipos !== undefined && input.tipos.length < 1) {
    throw new ValidationError('Debe especificar al menos un tipo de entidad')
  }

  // R2: codigo único
  if (input.codigo && input.codigo !== entidad.codigo) {
    const existente = await repo.findEntidadByCodigo(input.codigo, id)
    if (existente) {
      throw new ValidationError(`Ya existe una entidad con código "${input.codigo}"`)
    }
  }

  // País efectivo (el nuevo o el actual)
  const paisId = input.paisId ?? entidad.paisId
  const pais = await repo.findPaisById(paisId)
  if (!pais) throw new NotFoundError('País', String(paisId))

  // R3: identificador
  const identificadorEfectivo =
    input.identificador !== undefined ? input.identificador : entidad.identificador
  if (identificadorEfectivo) {
    if (pais.esPaisOrigen) {
      if (!validarRutChileno(identificadorEfectivo)) {
        throw new ValidationError(
          `El identificador "${identificadorEfectivo}" no es un RUT chileno válido`,
        )
      }
    }
    // Unicidad
    const existenteId = await repo.findEntidadByIdentificador(identificadorEfectivo, id)
    if (existenteId) {
      throw new ValidationError(
        `Ya existe una entidad con identificador "${identificadorEfectivo}"`,
      )
    }
  }

  // Giro obligatorio si país es Chile
  const giroEfectivo = input.giro !== undefined ? input.giro : entidad.giro
  if (pais.esPaisOrigen && !giroEfectivo) {
    throw new ValidationError('El giro es obligatorio para entidades nacionales (Chile)')
  }

  return repo.updateEntidad(id, input, userId)
}

export async function eliminarEntidad(id: number, userId: string) {
  const entidad = await repo.findEntidadById(id)
  if (!entidad) throw new NotFoundError('Entidad', String(id))

  // R7: verificar usos
  const usos = await repo.countEntidadUsos(id)
  if (usos > 0) {
    throw new ConflictError(
      `No se puede eliminar la entidad: está siendo utilizada en ${usos} documento${usos === 1 ? '' : 's'}`,
    )
  }

  await repo.softDeleteEntidad(id, userId)
}

// ─── Direcciones ──────────────────────────────────────────────────────────────

export async function crearDireccion(
  entidadId: number,
  input: DireccionCreateInput,
  userId: string,
) {
  const entidad = await repo.findEntidadById(entidadId)
  if (!entidad) throw new NotFoundError('Entidad', String(entidadId))

  // R2: codigo único por entidad entre no eliminados
  const existente = await repo.findDireccionByCodigo(input.codigo, entidadId)
  if (existente) {
    throw new ValidationError(
      `Ya existe una dirección con código "${input.codigo}" en esta entidad`,
    )
  }

  // Validar país de la dirección
  const pais = await repo.findPaisById(input.paisId)
  if (!pais) throw new NotFoundError('País', String(input.paisId))

  // R5: comunaId solo permitido si el país es Chile
  if (input.comunaId) {
    if (!pais.esPaisOrigen) {
      throw new ValidationError(
        'La comuna solo puede asignarse en direcciones de Chile',
      )
    }
    const comuna = await repo.findComunaById(input.comunaId)
    if (!comuna) throw new NotFoundError('Comuna', String(input.comunaId))
  }

  // R4: esPorDefecto → desmarcar la anterior
  if (input.esPorDefecto) {
    await repo.clearDireccionPorDefecto(entidadId)
  }

  return repo.createDireccion(entidadId, input, userId)
}

export async function actualizarDireccion(
  entidadId: number,
  dirId: number,
  input: DireccionUpdateInput,
  userId: string,
) {
  const entidad = await repo.findEntidadById(entidadId)
  if (!entidad) throw new NotFoundError('Entidad', String(entidadId))

  const dir = await repo.findDireccionById(dirId, entidadId)
  if (!dir) throw new NotFoundError('Dirección', String(dirId))

  // R2: codigo único
  if (input.codigo && input.codigo !== dir.codigo) {
    const existente = await repo.findDireccionByCodigo(input.codigo, entidadId, dirId)
    if (existente) {
      throw new ValidationError(
        `Ya existe una dirección con código "${input.codigo}" en esta entidad`,
      )
    }
  }

  // País efectivo
  const paisId = input.paisId ?? dir.paisId
  const pais = await repo.findPaisById(paisId)
  if (!pais) throw new NotFoundError('País', String(paisId))

  // R5: comunaId
  const comunaId = input.comunaId !== undefined ? input.comunaId : dir.comunaId
  if (comunaId) {
    if (!pais.esPaisOrigen) {
      throw new ValidationError(
        'La comuna solo puede asignarse en direcciones de Chile',
      )
    }
    const comuna = await repo.findComunaById(comunaId)
    if (!comuna) throw new NotFoundError('Comuna', String(comunaId))
  }

  // R4: esPorDefecto
  if (input.esPorDefecto) {
    await repo.clearDireccionPorDefecto(entidadId, dirId)
  }

  return repo.updateDireccion(dirId, input, userId)
}

export async function eliminarDireccion(
  entidadId: number,
  dirId: number,
  userId: string,
) {
  const entidad = await repo.findEntidadById(entidadId)
  if (!entidad) throw new NotFoundError('Entidad', String(entidadId))

  const dir = await repo.findDireccionById(dirId, entidadId)
  if (!dir) throw new NotFoundError('Dirección', String(dirId))

  // QAS-SI-001: no eliminar si hay solicitudes de inspección vigentes que la usan
  const usos = await repo.countDireccionUsos(dirId)
  if (usos > 0) {
    throw new ConflictError(
      `No se puede eliminar la dirección: está siendo utilizada en ${usos} solicitud${usos === 1 ? '' : 'es'} de inspección vigente${usos === 1 ? '' : 's'}.`,
    )
  }

  await repo.softDeleteDireccion(dirId, userId)
}

// ─── Contactos ────────────────────────────────────────────────────────────────

export async function crearContacto(
  entidadId: number,
  input: ContactoCreateInput,
  userId: string,
) {
  const entidad = await repo.findEntidadById(entidadId)
  if (!entidad) throw new NotFoundError('Entidad', String(entidadId))

  // R2: codigo único por entidad entre no eliminados
  const existente = await repo.findContactoByCodigo(input.codigo, entidadId)
  if (existente) {
    throw new ValidationError(
      `Ya existe un contacto con código "${input.codigo}" en esta entidad`,
    )
  }

  // R9: representante legal único y con RUT válido
  if (input.esRepresentanteLegal) {
    if (!input.rut) {
      throw new ValidationError('El representante legal debe tener RUT')
    }
    if (!validarRutChileno(input.rut)) {
      throw new ValidationError(`El RUT "${input.rut}" no es válido`)
    }
    const repActual = await repo.findRepresentanteLegalActivo(entidadId)
    if (repActual) {
      throw new ValidationError('Ya existe un representante legal activo para esta entidad')
    }
  }

  return repo.createContacto(entidadId, input, userId)
}

export async function actualizarContacto(
  entidadId: number,
  conId: number,
  input: ContactoUpdateInput,
  userId: string,
) {
  const entidad = await repo.findEntidadById(entidadId)
  if (!entidad) throw new NotFoundError('Entidad', String(entidadId))

  const contacto = await repo.findContactoById(conId, entidadId)
  if (!contacto) throw new NotFoundError('Contacto', String(conId))

  // R2: codigo único
  if (input.codigo && input.codigo !== contacto.codigo) {
    const existente = await repo.findContactoByCodigo(input.codigo, entidadId, conId)
    if (existente) {
      throw new ValidationError(
        `Ya existe un contacto con código "${input.codigo}" en esta entidad`,
      )
    }
  }

  // R9: representante legal único y con RUT válido
  const esRepLegal = input.esRepresentanteLegal !== undefined
    ? input.esRepresentanteLegal
    : contacto.esRepresentanteLegal
  if (esRepLegal) {
    const rutEfectivo = input.rut !== undefined ? input.rut : (contacto as Record<string, unknown>).rut as string | null
    if (!rutEfectivo) {
      throw new ValidationError('El representante legal debe tener RUT')
    }
    if (!validarRutChileno(rutEfectivo)) {
      throw new ValidationError(`El RUT "${rutEfectivo}" no es válido`)
    }
    const repActual = await repo.findRepresentanteLegalActivo(entidadId, conId)
    if (repActual) {
      throw new ValidationError('Ya existe un representante legal activo para esta entidad')
    }
  }

  return repo.updateContacto(conId, input, userId)
}

export async function eliminarContacto(
  entidadId: number,
  conId: number,
  userId: string,
) {
  const entidad = await repo.findEntidadById(entidadId)
  if (!entidad) throw new NotFoundError('Entidad', String(entidadId))

  const contacto = await repo.findContactoById(conId, entidadId)
  if (!contacto) throw new NotFoundError('Contacto', String(conId))

  // QAS-SI-001: no eliminar si hay solicitudes de inspección vigentes que lo usan
  const usos = await repo.countContactoUsos(conId)
  if (usos > 0) {
    throw new ConflictError(
      `No se puede eliminar el contacto: está siendo utilizado en ${usos} solicitud${usos === 1 ? '' : 'es'} de inspección vigente${usos === 1 ? '' : 's'}.`,
    )
  }

  await repo.softDeleteContacto(conId, userId)
}
