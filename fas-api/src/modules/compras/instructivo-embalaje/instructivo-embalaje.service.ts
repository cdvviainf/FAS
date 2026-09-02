import { Prisma } from '@prisma/client'
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './instructivo-embalaje.repository.js'
import type { InstructivoEmbalajeCreateInput, InstructivoEmbalajeDetalleInput, InstructivoEmbalajeUpdateInput } from './instructivo-embalaje.types.js'

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

  if (linea.variedadRotuladaId != null) {
    const variedadRotulada = await repo.getVariedad(linea.variedadRotuladaId)
    if (!variedadRotulada) throw new ValidationError(`${prefijo} la variedad rotulada seleccionada no existe o está bloqueada`)
    if (variedadRotulada.especieId !== linea.especieId) {
      throw new ValidationError(`${prefijo} la variedad rotulada no pertenece a la especie seleccionada`)
    }
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

  const altura = await repo.getAltura(linea.alturaId)
  if (!altura) throw new ValidationError(`${prefijo} la altura de pallet seleccionada no existe o está bloqueada`)
}

async function validarReferenciasHeader(data: { entidadProductorId?: number; grupoMercadoId?: number }) {
  if (data.entidadProductorId != null) {
    const productor = await repo.getEntidadProductor(data.entidadProductorId)
    if (!productor) throw new ValidationError('El productor seleccionado no existe o está inactivo')
    if (!productor.tipos.includes('PRODUCTOR')) {
      throw new ValidationError('La entidad seleccionada no tiene tipo Productor')
    }
  }
  if (data.grupoMercadoId != null) {
    const grupoMercado = await repo.getGrupoMercado(data.grupoMercadoId)
    if (!grupoMercado) throw new ValidationError('El grupo de mercado seleccionado no existe o está bloqueado')
  }
}

export async function listarInstructivos(
  page: number,
  limit: number,
  entidadProductorId?: number,
  estadoInspeccion?: 'PENDIENTE' | 'NOTIFICADA' | 'APROBADA' | 'RECHAZADA' | 'CERRADA',
  seleccionable?: boolean,
) {
  const { data, total } = await repo.listInstructivos(page, limit, entidadProductorId, estadoInspeccion, seleccionable)
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function obtenerInstructivo(id: number) {
  const instructivo = await repo.getInstructivoById(id)
  if (!instructivo) throw new NotFoundError('Instructivo de Embalaje', String(id))
  return instructivo
}

export async function crearInstructivo(body: InstructivoEmbalajeCreateInput, creadoPor: string) {
  await validarReferenciasHeader(body)

  for (const [index, linea] of body.detalle.entries()) {
    await validarLinea(linea, index)
  }

  return repo.createInstructivo(body, creadoPor)
}

// El Instructivo es la Inspección de Proceso (2026-08-21): mientras la
// inspección esté PENDIENTE o NOTIFICADA se puede editar/eliminar libremente;
// una vez que Calidad emitió veredicto (APROBADA/RECHAZADA/CERRADA) queda
// congelado —el veredicto y los folios se apoyan en un snapshot estable de la
// fruta—. (No depende de la NV desde la supersesión 2026-08-12, compras.md §4.1.)
// El check de estado se repite atómicamente en el repositorio
// (updateInstructivoSiEditable) — esta lectura previa solo da un 404 rápido
// y una mejor traza; la fuente de verdad del bloqueo por veredicto es el
// WHERE condicionado del repositorio (FAS-INSP-1A-002, evita la carrera
// entre este check y el update).
export async function actualizarInstructivo(id: number, body: InstructivoEmbalajeUpdateInput) {
  await obtenerInstructivo(id)

  await validarReferenciasHeader(body)

  if (body.detalle) {
    for (const [index, linea] of body.detalle.entries()) {
      await validarLinea(linea, index)
    }
  }

  const actualizado = await repo.updateInstructivoSiEditable(id, body)
  if (actualizado === null) {
    await obtenerInstructivo(id) // 404 si fue eliminado justo ahora
    throw new ConflictError('No se puede editar un instructivo cuya inspección de proceso ya tiene veredicto')
  }
  return actualizado
}

// Soft delete — bloqueado una vez emitido el veredicto, mismo criterio que la
// edición (ver nota arriba); mismo patrón de reclamo atómico en el repositorio.
export async function eliminarInstructivo(id: number, eliminadoPor: string) {
  await obtenerInstructivo(id)
  const count = await repo.softDeleteInstructivoSiEditable(id, eliminadoPor)
  if (count === 0) {
    await obtenerInstructivo(id) // 404 si fue eliminado justo ahora
    throw new ConflictError('No se puede eliminar un instructivo cuya inspección de proceso ya tiene veredicto')
  }
}

// ─── Inspección de Proceso: transiciones de estado ──────────────────────────
// Flujo: PENDIENTE → NOTIFICADA → APROBADA → CERRADA, con RECHAZADA terminal.
// Aprobar/Rechazar se admiten tanto desde PENDIENTE como NOTIFICADA (notificar
// es opcional); los folios solo se cargan en APROBADA (SQ4).

// Las 4 transiciones usan updateEstadoInspeccionCondicional (updateMany con
// WHERE de estado esperado, FAS-INSP-1A-002): si count === 0, el estado no
// era el esperado (o la fila no existe/fue eliminada) — se reconsulta solo
// para decidir 404 vs 409, sin reabrir la ventana de carrera (la escritura ya
// se resolvió atómicamente en el repositorio).

export async function notificarInspeccion(id: number) {
  const count = await repo.updateEstadoInspeccionCondicional(id, ['PENDIENTE'], {
    estadoInspeccion: 'NOTIFICADA',
    notificadaEn: new Date(),
  })
  if (count === 0) {
    await obtenerInstructivo(id)
    throw new ConflictError('Solo se puede notificar una inspección de proceso en estado Pendiente')
  }
  return repo.getInstructivoById(id)
}

// comentario es obligatorio (calidad.md §4, QA ronda 2 FAS-INSP-1A-R2-002) —
// ya lo exige inspeccionAprobarSchema, mismo criterio que rechazarInspeccion.
export async function aprobarInspeccion(id: number, comentario: string, userId: string) {
  const count = await repo.updateEstadoInspeccionCondicional(id, ['PENDIENTE', 'NOTIFICADA'], {
    estadoInspeccion: 'APROBADA',
    comentarioInspeccion: comentario,
    inspeccionadoEn: new Date(),
    inspeccionadoPor: userId,
  })
  if (count === 0) {
    await obtenerInstructivo(id)
    throw new ConflictError('Solo se puede aprobar una inspección de proceso Pendiente o Notificada')
  }
  return repo.getInstructivoById(id)
}

export async function rechazarInspeccion(id: number, comentario: string, userId: string) {
  const count = await repo.updateEstadoInspeccionCondicional(id, ['PENDIENTE', 'NOTIFICADA'], {
    estadoInspeccion: 'RECHAZADA',
    comentarioInspeccion: comentario,
    inspeccionadoEn: new Date(),
    inspeccionadoPor: userId,
  })
  if (count === 0) {
    await obtenerInstructivo(id)
    throw new ConflictError('Solo se puede rechazar una inspección de proceso Pendiente o Notificada')
  }
  return repo.getInstructivoById(id)
}

// Exige al menos 1 folio cargado para cerrar (decisión de negocio, Christian,
// 2026-08-21). El check de folios corre atómicamente junto con la transición
// dentro de la misma transacción (repo.cerrarInspeccionSiCorresponde) — evita
// la carrera con addFolios/quitarFolio (FAS-INSP-1A-002).
export async function cerrarInspeccion(id: number) {
  const resultado = await repo.cerrarInspeccionSiCorresponde(id)
  if (resultado.estado === 'NO_ENCONTRADO') {
    throw new NotFoundError('Instructivo de Embalaje', String(id))
  }
  if (resultado.estado === 'ESTADO_INVALIDO') {
    throw new ConflictError('Solo se puede cerrar una inspección de proceso Aprobada')
  }
  if (resultado.estado === 'SIN_FOLIOS') {
    throw new ValidationError('No se puede cerrar una inspección de proceso sin folios cargados')
  }
  return resultado.instructivo
}

// ─── Inspección de Proceso: folios (números de pallet) ───────────────────────

// El check de estado y la escritura de folios corren atómicamente juntos en
// el repositorio (repo.addFoliosSiAprobada, FAS-INSP-1A-002) — evita que un
// `cerrar` concurrente se cuele entre el check y el createMany.
export async function agregarFolios(id: number, folios: string[], userId: string) {
  // Normaliza y deduplica dentro del propio lote (case-sensitive: el folio es
  // un identificador literal del pallet).
  const unicos = Array.from(new Set(folios.map((f) => f.trim()).filter((f) => f.length > 0)))
  if (unicos.length === 0) throw new ValidationError('Debe indicar al menos un folio')

  // Unicidad sistémica por empresa (SQ2): ningún folio puede repetirse en todo
  // el sistema. El índice único (empresaId, folio) es la última defensa; esta
  // consulta da un mensaje claro con los folios en conflicto.
  const colisiones = await repo.getFoliosColisionados(unicos)
  if (colisiones.length > 0) {
    const lista = colisiones.map((c) => c.folio).join(', ')
    throw new ConflictError(`Los siguientes folios ya existen en el sistema: ${lista}`)
  }

  try {
    const resultado = await repo.addFoliosSiAprobada(id, unicos, userId)
    if (resultado === null) {
      await obtenerInstructivo(id) // 404 si no existe/fue eliminado
      throw new ConflictError('Solo se pueden cargar folios en una inspección de proceso Aprobada')
    }
    return resultado
  } catch (e) {
    // Carrera concurrente: dos cargas simultáneas del mismo folio pasan el
    // pre-check y colisionan en el índice único (empresaId, folio). El
    // pre-check da el mensaje habitual; esto sólo cubre el empate de reloj.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictError('Uno o más folios ya existen en el sistema (carga simultánea)')
    }
    throw e
  }
}

// Mismo patrón atómico que agregarFolios (repo.deleteFolioSiAprobada).
export async function quitarFolio(id: number, folioId: number) {
  const resultado = await repo.deleteFolioSiAprobada(id, folioId)
  if (!resultado.ok) {
    if (resultado.motivo === 'ESTADO') {
      await obtenerInstructivo(id) // 404 si no existe/fue eliminado
      throw new ConflictError('Solo se pueden quitar folios en una inspección de proceso Aprobada')
    }
    if (resultado.motivo === 'NO_ENCONTRADO') {
      throw new NotFoundError('Folio de inspección de proceso', String(folioId))
    }
    throw new ConflictError('No se puede quitar un folio que ya fue recepcionado')
  }
  return obtenerInstructivo(id)
}
