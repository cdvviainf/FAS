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
import { Prisma, type TipoEntidad } from '@prisma/client'

// ─── Entidades ────────────────────────────────────────────────────────────────

export async function listarEntidades(
  page: number,
  limit: number,
  q?: string,
  tipo?: TipoEntidad,
  activo?: boolean,
  sort?: string,
) {
  const { data, total } = await repo.findAllEntidades(page, limit, q, tipo, activo, sort)
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

export async function crearEntidad(
  input: EntidadCreateInput,
  userId: string,
  // Carga Masiva (2026-11-05): permitirSinTaxId deja crear un CLIENTE_EXTRANJERO sin
  // TaxID (se completa después); el alta manual por pantalla lo sigue exigiendo.
  opts?: { permitirSinTaxId?: boolean },
) {
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

  // R3: DV y unicidad del identificador SOLO para entidades chilenas. Las
  // extranjeras (país ≠ Chile) pueden repetir el identificador —no tienen RUT
  // chileno y suelen compartir un placeholder (ej. 55555555-5).
  if (input.identificador && pais.esPaisNacional) {
    if (!validarRutChileno(input.identificador)) {
      throw new ValidationError(
        `El identificador "${input.identificador}" no es un RUT chileno válido`,
      )
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
  if (pais.esPaisNacional && !input.giro) {
    throw new ValidationError('El giro es obligatorio para entidades nacionales (Chile)')
  }

  // CSP obligatorio si la entidad es PLANTA o PACKING; TAXID si es CLIENTE_EXTRANJERO
  if ((input.tipos.includes('PLANTA') || input.tipos.includes('PACKING')) && !input.csp?.trim()) {
    throw new ValidationError('El CSP es obligatorio para entidades de tipo Planta o Packing')
  }
  if (input.tipos.includes('CLIENTE_EXTRANJERO') && !input.taxId && !opts?.permitirSinTaxId) {
    throw new ValidationError('El TAXID es obligatorio para entidades de tipo Cliente Extranjero')
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

  // R3: DV y unicidad del identificador SOLO para entidades chilenas (ver crearEntidad).
  const identificadorEfectivo =
    input.identificador !== undefined ? input.identificador : entidad.identificador
  if (identificadorEfectivo && pais.esPaisNacional) {
    if (!validarRutChileno(identificadorEfectivo)) {
      throw new ValidationError(
        `El identificador "${identificadorEfectivo}" no es un RUT chileno válido`,
      )
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
  if (pais.esPaisNacional && !giroEfectivo) {
    throw new ValidationError('El giro es obligatorio para entidades nacionales (Chile)')
  }

  // CSP obligatorio si es PLANTA o PACKING; TAXID si es CLIENTE_EXTRANJERO (valor
  // efectivo: el nuevo si viene en el request, el actual en BD si no).
  const tiposEfectivos = input.tipos ?? entidad.tipos
  const cspEfectivo = input.csp !== undefined ? input.csp : entidad.csp
  const taxIdEfectivo = input.taxId !== undefined ? input.taxId : entidad.taxId
  if ((tiposEfectivos.includes('PLANTA') || tiposEfectivos.includes('PACKING')) && !cspEfectivo?.trim()) {
    throw new ValidationError('El CSP es obligatorio para entidades de tipo Planta o Packing')
  }
  if (tiposEfectivos.includes('CLIENTE_EXTRANJERO') && !taxIdEfectivo) {
    throw new ValidationError('El TAXID es obligatorio para entidades de tipo Cliente Extranjero')
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
    if (!pais.esPaisNacional) {
      throw new ValidationError(
        'La comuna solo puede asignarse en direcciones de Chile',
      )
    }
    const comuna = await repo.findComunaById(input.comunaId)
    if (!comuna) throw new NotFoundError('Comuna', String(input.comunaId))
  }

  // Puerto opcional: validar que exista en la empresa activa.
  if (input.puertoId != null) {
    const puerto = await repo.findPuertoActivo(input.puertoId)
    if (!puerto) throw new NotFoundError('Puerto', String(input.puertoId))
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
    if (!pais.esPaisNacional) {
      throw new ValidationError(
        'La comuna solo puede asignarse en direcciones de Chile',
      )
    }
    const comuna = await repo.findComunaById(comunaId)
    if (!comuna) throw new NotFoundError('Comuna', String(comunaId))
  }

  // Puerto opcional: validar que exista en la empresa activa (si se envía).
  if (input.puertoId != null) {
    const puerto = await repo.findPuertoActivo(input.puertoId)
    if (!puerto) throw new NotFoundError('Puerto', String(input.puertoId))
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

type CategoriaContacto = 'COMPRADOR' | 'NOTIFY' | 'CONSIGNATARIO'

// Categorías comerciales (2026-11-05): categoriasPorDefecto ⊆ categorias; si el
// contacto es NOTIFY y/o CONSIGNATARIO, debe vincularse a una Entidad real
// (activa, de la empresa activa) que tenga el/los TipoEntidad correspondientes
// — esa Entidad es la que usan Cierre/Instructivo/Proforma/DTE (TAXID,
// dirección). Sin esas categorías, el vínculo se limpia.
async function validarCategoriasContacto(
  entidadId: number,
  categorias: CategoriaContacto[],
  categoriasPorDefecto: CategoriaContacto[],
  entidadVinculadaId: number | null,
): Promise<number | null> {
  const set = new Set(categorias)
  if (set.size !== categorias.length) throw new ValidationError('Hay categorías de contacto repetidas')
  for (const c of categoriasPorDefecto) {
    if (!set.has(c)) throw new ValidationError('Solo se puede marcar "por defecto" una categoría asignada al contacto')
  }
  const requiereVinculo = set.has('NOTIFY') || set.has('CONSIGNATARIO')
  if (!requiereVinculo) return null
  if (entidadVinculadaId == null) {
    throw new ValidationError('Un contacto Notify/Consignatario debe vincularse a la Entidad correspondiente')
  }
  if (entidadVinculadaId === entidadId) {
    throw new ValidationError('El contacto no puede vincularse a la misma entidad')
  }
  const vinculada = await repo.findEntidadVinculable(entidadVinculadaId)
  if (!vinculada) throw new ValidationError('La entidad vinculada no existe o está inactiva')
  if (set.has('NOTIFY') && !vinculada.tipos.includes('NOTIFY')) {
    throw new ValidationError('La entidad vinculada no tiene tipo Notify')
  }
  if (set.has('CONSIGNATARIO') && !vinculada.tipos.includes('CONSIGNATARIO')) {
    throw new ValidationError('La entidad vinculada no tiene tipo Consignatario')
  }
  return entidadVinculadaId
}

// CCN26-R1-001: los índices únicos parciales `entidad_contactos_default_*_key`
// garantizan un solo contacto por defecto por (entidad, categoría). Si dos
// guardados concurrentes chocan, se traduce a un conflicto de negocio (409).
async function conDefaultUnico<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002' &&
      // Prisma reporta el target como nombre de índice o como lista de campos
      // (['entidadId']); entidad_contactos no tiene otro único sobre entidadId.
      /_default_|entidadId/.test(String((err.meta as { target?: unknown } | undefined)?.target ?? ''))
    ) {
      throw new ConflictError('Otro contacto de esta entidad se marcó como por defecto para la misma categoría al mismo tiempo. Recarga e intenta de nuevo.')
    }
    throw err
  }
}

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

  const categorias = input.categorias ?? []
  const categoriasPorDefecto = input.categoriasPorDefecto ?? []
  const entidadVinculadaId = await validarCategoriasContacto(
    entidadId,
    categorias,
    categoriasPorDefecto,
    input.entidadVinculadaId ?? null,
  )

  return conDefaultUnico(() =>
    repo.createContacto(entidadId, { ...input, categorias, categoriasPorDefecto, entidadVinculadaId }, userId),
  )
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

  // Categorías: se valida el estado EFECTIVO (lo que llega ∪ lo persistido).
  let entidadVinculadaId = input.entidadVinculadaId
  if (
    input.categorias !== undefined ||
    input.categoriasPorDefecto !== undefined ||
    input.entidadVinculadaId !== undefined
  ) {
    entidadVinculadaId = await validarCategoriasContacto(
      entidadId,
      input.categorias ?? contacto.categorias,
      input.categoriasPorDefecto ?? contacto.categoriasPorDefecto,
      input.entidadVinculadaId !== undefined ? input.entidadVinculadaId : contacto.entidadVinculadaId,
    )
  }

  return conDefaultUnico(() => repo.updateContacto(conId, { ...input, entidadVinculadaId }, userId))
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
