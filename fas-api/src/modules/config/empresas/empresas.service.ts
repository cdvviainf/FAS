import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import { validarRutChileno } from '../../../shared/rut-validator.js'
import * as repo from './empresas.repository.js'
import type {
  EmpresaCreateInput,
  EmpresaUpdateInput,
  DireccionCreateInput,
  DireccionUpdateInput,
  ContactoCreateInput,
  ContactoUpdateInput,
} from './empresas.schema.js'

// ─── Empresas ─────────────────────────────────────────────────────────────────

export async function listarEmpresas(page: number, limit: number, q?: string, activo?: boolean) {
  const { data, total } = await repo.findAllEmpresas(page, limit, q, activo)
  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
}

export async function obtenerEmpresa(id: number) {
  const empresa = await repo.findEmpresaById(id)
  if (!empresa) throw new NotFoundError('Empresa', String(id))
  return empresa
}

export async function crearEmpresa(input: EmpresaCreateInput, userId: string) {
  const existente = await repo.findEmpresaByCodigo(input.codigo)
  if (existente) {
    throw new ValidationError(`Ya existe una empresa con código "${input.codigo}"`)
  }

  await validarDireccionesNuevas(input.direcciones)
  validarContactosNuevos(input.contactos)

  // Empresa + direcciones + contactos se crean en una única escritura Prisma
  // (atómica) para no dejar la empresa en un estado parcial ni "quemar" su
  // código único si un hijo falla a mitad de camino.
  return repo.createEmpresaCompleta(input, userId)
}

async function validarDireccionesNuevas(direcciones: DireccionCreateInput[]) {
  const codigosVistos = new Set<string>()
  let defectosVistos = 0

  for (const dir of direcciones) {
    if (codigosVistos.has(dir.codigo)) {
      throw new ValidationError(`Código de dirección duplicado: "${dir.codigo}"`)
    }
    codigosVistos.add(dir.codigo)

    const pais = await repo.findPaisById(dir.paisId)
    if (!pais) throw new NotFoundError('País', String(dir.paisId))

    if (dir.comunaId) {
      if (!pais.esPaisNacional) {
        throw new ValidationError('La comuna solo puede asignarse en direcciones de Chile')
      }
      const comuna = await repo.findComunaById(dir.comunaId)
      if (!comuna) throw new NotFoundError('Comuna', String(dir.comunaId))
    }

    if (dir.esPorDefecto) defectosVistos++
  }

  if (defectosVistos > 1) {
    throw new ValidationError('Solo una dirección puede marcarse como principal')
  }
}

function validarContactosNuevos(contactos: ContactoCreateInput[]) {
  const codigosVistos = new Set<string>()
  let representantesVistos = 0

  for (const con of contactos) {
    if (codigosVistos.has(con.codigo)) {
      throw new ValidationError(`Código de contacto duplicado: "${con.codigo}"`)
    }
    codigosVistos.add(con.codigo)

    if (con.esRepresentanteLegal) {
      validarRutRepresentanteLegal(con.rut)
      representantesVistos++
    }
  }

  if (representantesVistos > 1) {
    throw new ValidationError('Solo un contacto puede marcarse como representante legal')
  }
}

export async function actualizarEmpresa(id: number, input: EmpresaUpdateInput, userId: string) {
  const empresa = await repo.findEmpresaById(id)
  if (!empresa) throw new NotFoundError('Empresa', String(id))

  if (input.codigo && input.codigo !== empresa.codigo) {
    const existente = await repo.findEmpresaByCodigo(input.codigo, id)
    if (existente) {
      throw new ValidationError(`Ya existe una empresa con código "${input.codigo}"`)
    }
  }

  return repo.updateEmpresa(id, input, userId)
}

export async function eliminarEmpresa(id: number, userId: string) {
  const empresa = await repo.findEmpresaById(id)
  if (!empresa) throw new NotFoundError('Empresa', String(id))
  await repo.softDeleteEmpresa(id, userId)
}

// ─── Direcciones ──────────────────────────────────────────────────────────────

export async function crearDireccion(empresaId: number, input: DireccionCreateInput, userId: string) {
  const empresa = await repo.findEmpresaById(empresaId)
  if (!empresa) throw new NotFoundError('Empresa', String(empresaId))

  const existente = await repo.findDireccionByCodigo(input.codigo, empresaId)
  if (existente) {
    throw new ValidationError(`Ya existe una dirección con código "${input.codigo}" en esta empresa`)
  }

  const pais = await repo.findPaisById(input.paisId)
  if (!pais) throw new NotFoundError('País', String(input.paisId))

  if (input.comunaId) {
    if (!pais.esPaisNacional) {
      throw new ValidationError('La comuna solo puede asignarse en direcciones de Chile')
    }
    const comuna = await repo.findComunaById(input.comunaId)
    if (!comuna) throw new NotFoundError('Comuna', String(input.comunaId))
  }

  if (input.esPorDefecto) {
    await repo.clearDireccionPorDefecto(empresaId)
  }

  return repo.createDireccion(empresaId, input, userId)
}

export async function actualizarDireccion(
  empresaId: number,
  dirId: number,
  input: DireccionUpdateInput,
  userId: string,
) {
  const empresa = await repo.findEmpresaById(empresaId)
  if (!empresa) throw new NotFoundError('Empresa', String(empresaId))

  const dir = await repo.findDireccionById(dirId, empresaId)
  if (!dir) throw new NotFoundError('Dirección', String(dirId))

  if (input.codigo && input.codigo !== dir.codigo) {
    const existente = await repo.findDireccionByCodigo(input.codigo, empresaId, dirId)
    if (existente) {
      throw new ValidationError(`Ya existe una dirección con código "${input.codigo}" en esta empresa`)
    }
  }

  const paisId = input.paisId ?? dir.paisId
  const pais = await repo.findPaisById(paisId)
  if (!pais) throw new NotFoundError('País', String(paisId))

  const comunaId = input.comunaId !== undefined ? input.comunaId : dir.comunaId
  if (comunaId) {
    if (!pais.esPaisNacional) {
      throw new ValidationError('La comuna solo puede asignarse en direcciones de Chile')
    }
    const comuna = await repo.findComunaById(comunaId)
    if (!comuna) throw new NotFoundError('Comuna', String(comunaId))
  }

  if (input.esPorDefecto) {
    await repo.clearDireccionPorDefecto(empresaId, dirId)
  }

  return repo.updateDireccion(dirId, input, userId)
}

export async function eliminarDireccion(empresaId: number, dirId: number, userId: string) {
  const empresa = await repo.findEmpresaById(empresaId)
  if (!empresa) throw new NotFoundError('Empresa', String(empresaId))

  const dir = await repo.findDireccionById(dirId, empresaId)
  if (!dir) throw new NotFoundError('Dirección', String(dirId))

  await repo.softDeleteDireccion(dirId, userId)
}

// ─── Contactos ────────────────────────────────────────────────────────────────

function validarRutRepresentanteLegal(rut: string | null | undefined) {
  if (!rut || !rut.trim()) {
    throw new ValidationError('El RUT es requerido para el representante legal')
  }
  if (!validarRutChileno(rut.trim())) {
    throw new ValidationError('RUT inválido para el representante legal')
  }
}

export async function crearContacto(empresaId: number, input: ContactoCreateInput, userId: string) {
  const empresa = await repo.findEmpresaById(empresaId)
  if (!empresa) throw new NotFoundError('Empresa', String(empresaId))

  const existente = await repo.findContactoByCodigo(input.codigo, empresaId)
  if (existente) {
    throw new ValidationError(`Ya existe un contacto con código "${input.codigo}" en esta empresa`)
  }

  if (input.esRepresentanteLegal) {
    validarRutRepresentanteLegal(input.rut)
    const repActual = await repo.findRepresentanteLegalActivo(empresaId)
    if (repActual) {
      throw new ValidationError('Ya existe un representante legal activo para esta empresa')
    }
  }

  return repo.createContacto(empresaId, input, userId)
}

export async function actualizarContacto(
  empresaId: number,
  conId: number,
  input: ContactoUpdateInput,
  userId: string,
) {
  const empresa = await repo.findEmpresaById(empresaId)
  if (!empresa) throw new NotFoundError('Empresa', String(empresaId))

  const contacto = await repo.findContactoById(conId, empresaId)
  if (!contacto) throw new NotFoundError('Contacto', String(conId))

  if (input.codigo && input.codigo !== contacto.codigo) {
    const existente = await repo.findContactoByCodigo(input.codigo, empresaId, conId)
    if (existente) {
      throw new ValidationError(`Ya existe un contacto con código "${input.codigo}" en esta empresa`)
    }
  }

  const esRepLegal = input.esRepresentanteLegal !== undefined
    ? input.esRepresentanteLegal
    : contacto.esRepresentanteLegal
  if (esRepLegal) {
    const rutEfectivo = input.rut !== undefined ? input.rut : contacto.rut
    validarRutRepresentanteLegal(rutEfectivo)
    const repActual = await repo.findRepresentanteLegalActivo(empresaId, conId)
    if (repActual) {
      throw new ValidationError('Ya existe un representante legal activo para esta empresa')
    }
  }

  return repo.updateContacto(conId, input, userId)
}

export async function eliminarContacto(empresaId: number, conId: number, userId: string) {
  const empresa = await repo.findEmpresaById(empresaId)
  if (!empresa) throw new NotFoundError('Empresa', String(empresaId))

  const contacto = await repo.findContactoById(conId, empresaId)
  if (!contacto) throw new NotFoundError('Contacto', String(conId))

  await repo.softDeleteContacto(conId, userId)
}
