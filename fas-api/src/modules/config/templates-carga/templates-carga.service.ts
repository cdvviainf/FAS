import { Prisma } from '@prisma/client'
import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './templates-carga.repository.js'
import { CAMPOS_TEMPLATE_CARGA } from './templates-carga.types.js'
import type { TemplateCargaCreateInput, TemplateCargaUpdateInput, TemplateCargaCampoInput } from './templates-carga.types.js'

interface TemplateCoherencia {
  tieneCabecera: boolean
  filaCabecera?: number | null
  filaPrimerRegistro: number
  campos: TemplateCargaCampoInput[]
}

// Valida el objeto EFECTIVO completo (ya fusionado con lo persistido en caso
// de un PATCH parcial) — nunca un fragmento aislado (QAR-RCT-003).
function validarCoherenciaTemplate(d: TemplateCoherencia) {
  if (d.tieneCabecera && d.filaCabecera == null) {
    throw new ValidationError('La fila de cabecera es requerida')
  }
  if (!d.tieneCabecera && d.filaCabecera != null) {
    throw new ValidationError('Sin cabecera no corresponde indicar la fila de cabecera')
  }
  if (d.tieneCabecera && d.filaCabecera != null && d.filaPrimerRegistro <= d.filaCabecera) {
    throw new ValidationError('La fila del primer registro debe ser posterior a la fila de cabecera')
  }

  // El motor de carga necesita los 8 campos para materializar Pallet/PalletLinea
  // (compras.md §4.5-4.6, §7) — un template incompleto nunca podría procesarse
  // (QAR-RCT-001). Dos campos distintos no pueden apuntar a la misma columna:
  // una sola celda no puede representar dos datos simultáneamente (QAR-RCT-001,
  // ronda 2) — comparación normalizada (trim + mayúsculas) para atrapar
  // duplicados por capitalización o espacios.
  const camposVistos = new Set<string>()
  const columnasVistas = new Map<string, string>()
  for (const c of d.campos) {
    if (camposVistos.has(c.campo)) throw new ValidationError(`El campo "${c.campo}" está repetido`)
    camposVistos.add(c.campo)
    if (!d.tieneCabecera && !/^[A-Za-z]+$/.test(c.columna)) {
      throw new ValidationError('Sin cabecera, la columna debe ser una letra de Excel (A, B, C...)')
    }
    const columnaNormalizada = c.columna.trim().toUpperCase()
    const otroCampo = columnasVistas.get(columnaNormalizada)
    if (otroCampo) {
      throw new ValidationError(`Los campos "${otroCampo}" y "${c.campo}" no pueden apuntar a la misma columna`)
    }
    columnasVistas.set(columnaNormalizada, c.campo)
  }
  const faltantes = CAMPOS_TEMPLATE_CARGA.filter((campo) => !camposVistos.has(campo))
  if (faltantes.length > 0) {
    throw new ValidationError(`Deben mapearse todos los campos. Faltan: ${faltantes.join(', ')}`)
  }
}

export async function listarTemplatesCarga(q?: string) {
  return repo.listTemplatesCarga(q)
}

export async function obtenerTemplateCarga(id: number) {
  const template = await repo.getTemplateCargaById(id)
  if (!template) throw new NotFoundError('Template de Carga', String(id))
  return template
}

export async function crearTemplateCarga(body: TemplateCargaCreateInput, userId: string) {
  validarCoherenciaTemplate(body)
  const existente = await repo.findTemplateCargaByCodigo(body.codigo)
  if (existente) throw new ValidationError(`Ya existe un template de carga con código "${body.codigo}"`)
  try {
    return await repo.createTemplateCarga(body, userId)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ValidationError(`Ya existe un template de carga con código "${body.codigo}"`)
    }
    throw err
  }
}

export async function actualizarTemplateCarga(id: number, body: TemplateCargaUpdateInput, userId: string) {
  const existente = await obtenerTemplateCarga(id)
  validarCoherenciaTemplate({
    tieneCabecera: body.tieneCabecera ?? existente.tieneCabecera,
    filaCabecera: body.filaCabecera !== undefined ? body.filaCabecera : existente.filaCabecera,
    filaPrimerRegistro: body.filaPrimerRegistro ?? existente.filaPrimerRegistro,
    campos: body.campos ?? existente.campos,
  })
  return repo.updateTemplateCarga(id, body, userId)
}

export async function eliminarTemplateCarga(id: number, userId: string) {
  await obtenerTemplateCarga(id)
  await repo.softDeleteTemplateCarga(id, userId)
}
