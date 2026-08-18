import { Prisma } from '@prisma/client'
import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './recepciones.repository.js'
import { procesarCargaExcel } from './recepciones.motor.js'
import type { RecepcionCreateInput, RecepcionUpdateInput } from './recepciones.types.js'

// Editable/eliminable/re-procesable mientras no haya quedado firme: CARGADA
// (recién creada) o RECHAZADA (intento anterior no cuadró, se corrige y se
// reintenta). VALIDADA es terminal — ya generó pallets a Stock.
const ESTADOS_MODIFICABLES = new Set(['CARGADA', 'RECHAZADA'])

// QA-RCV-002: el estado por sí solo no basta — en modo consignación
// (compras.md §8) el estado se queda en CARGADA aunque ya haya generado
// pallets y esos pallets ya sean Stock real. "Modificable" exige además que
// no existan pallets todavía.
async function puedeModificarse(recepcion: { id: number; estado: string }): Promise<boolean> {
  if (!ESTADOS_MODIFICABLES.has(recepcion.estado)) return false
  return !(await repo.tienePallets(recepcion.id))
}

// Solo .xlsx (ExcelJS no lee el formato binario BIFF de .xls legado —
// QA-RCV-004): antes se aceptaba el MIME de .xls pero el lector fallaba
// igual al intentar parsearlo, con un mensaje engañoso de "archivo dañado".
const MIMES_EXCEL_PERMITIDOS = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])
export const MAX_ADJUNTO_BYTES = 10 * 1024 * 1024 // 10 MB

async function validarPlantaYDireccion(plantaId?: number, direccionPlantaId?: number) {
  if (plantaId == null) return
  const planta = await repo.getEntidadPlanta(plantaId)
  if (!planta) throw new ValidationError('La planta seleccionada no existe')
  if (!planta.activo) throw new ValidationError('La planta seleccionada está inactiva')
  if (!planta.tipos.includes('PLANTA')) throw new ValidationError('La entidad seleccionada no tiene tipo Planta')

  if (direccionPlantaId == null) return
  const direccion = await repo.getDireccionDeEntidad(direccionPlantaId, plantaId)
  if (!direccion) throw new ValidationError('La dirección seleccionada no pertenece a la planta')
}

async function validarOrdenCompra(ordenCompraId?: number | null) {
  if (ordenCompraId == null) return
  const oc = await repo.getOrdenCompra(ordenCompraId)
  if (!oc) throw new ValidationError('La Orden de Compra seleccionada no existe')
  if (oc.estado !== 'EMITIDA') {
    throw new ValidationError('Solo se puede recepcionar una Orden de Compra en estado Emitida')
  }
  const recepcionActiva = await repo.getRecepcionActivaPorOrdenCompra(ordenCompraId)
  if (recepcionActiva) throw new ValidationError('La Orden de Compra seleccionada ya tiene una Recepción asociada')
}

async function validarTemplateCarga(templateCargaId?: number | null) {
  if (templateCargaId == null) return
  const template = await repo.getTemplateCarga(templateCargaId)
  if (!template) throw new ValidationError('El template de carga seleccionado no existe')
  if (template.bloqueado) throw new ValidationError('El template de carga seleccionado está bloqueado')
  // Defensa en profundidad: el picker del frontend ya filtra por
  // tipo=RECEPCION, esto cubre un request armado a mano saltándose el filtro.
  if (template.tipo !== 'RECEPCION') {
    throw new ValidationError('El template de carga seleccionado no es de tipo Recepción')
  }
}

// QA-RCV-002 (ronda 1): expone al frontend, por cada Recepción, si ya generó
// pallets y si por lo tanto sigue siendo editable — el estado por sí solo
// (CARGADA) no alcanza en consignación, ver puedeModificarse() arriba. El
// frontend usa estos dos campos en vez de reimplementar la regla.
function shapeRecepcion<T extends { estado: string; _count: { pallets: number } }>(recepcion: T) {
  const { _count, ...resto } = recepcion
  const tienePallets = _count.pallets > 0
  return { ...resto, tienePallets, editable: ESTADOS_MODIFICABLES.has(resto.estado) && !tienePallets }
}

export async function listarRecepciones(page: number, limit: number, plantaId?: number, origen?: string, estado?: string) {
  const { data, total } = await repo.listRecepciones(page, limit, plantaId, origen, estado)
  return { data: data.map(shapeRecepcion), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

// Sin shapeRecepcion a propósito: los usos internos (actualizar/eliminar/
// subir adjunto, vía puedeModificarse) solo necesitan estado/ids, no la
// forma de salida HTTP. El controller usa obtenerRecepcionParaRespuesta().
export async function obtenerRecepcion(id: number) {
  const recepcion = await repo.getRecepcionById(id)
  if (!recepcion) throw new NotFoundError('Recepción', String(id))
  return recepcion
}

export async function obtenerRecepcionParaRespuesta(id: number) {
  return shapeRecepcion(await obtenerRecepcion(id))
}

export async function crearRecepcion(body: RecepcionCreateInput, creadoPor: string) {
  await validarOrdenCompra(body.ordenCompraId)
  await validarPlantaYDireccion(body.plantaId, body.direccionPlantaId)
  await validarTemplateCarga(body.templateCargaId)
  try {
    return shapeRecepcion(await repo.createRecepcion(body, creadoPor))
  } catch (err) {
    // El check-then-create de arriba no es atómico: si dos solicitudes
    // concurrentes pasan la validación a la vez, el índice único parcial de
    // BD (WHERE eliminadoEn IS NULL) rechaza la segunda inserción.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ValidationError('La Orden de Compra seleccionada ya tiene una Recepción asociada')
    }
    throw err
  }
}

export async function actualizarRecepcion(id: number, body: RecepcionUpdateInput, actualizadoPor: string) {
  const existente = await obtenerRecepcion(id)
  // Editable mientras no haya quedado firme (compras.md §8: Cargada ->
  // Validada). RECHAZADA también es editable: es el estado que deja una
  // carga que no cuadró contra la OC, y la planta necesita poder corregir
  // cabecera/template antes de reintentar. Ver puedeModificarse() sobre por
  // qué el estado solo no basta.
  if (!(await puedeModificarse(existente))) {
    throw new ValidationError('La Recepción ya fue procesada y no puede editarse')
  }
  // Un PATCH parcial no puede validarse aislado: si solo viene uno de los dos
  // campos, hay que evaluar la pareja efectiva contra lo persistido, no dejar
  // que quede una dirección de otra planta sin detectarlo (QAR-RCT-002).
  await validarPlantaYDireccion(
    body.plantaId ?? existente.plantaId,
    body.direccionPlantaId ?? existente.direccionPlantaId,
  )
  await validarTemplateCarga(body.templateCargaId)
  return shapeRecepcion(await repo.updateRecepcion(id, body, actualizadoPor))
}

export async function eliminarRecepcion(id: number, eliminadoPor: string) {
  const existente = await obtenerRecepcion(id)
  if (!(await puedeModificarse(existente))) {
    throw new ValidationError('La Recepción ya fue procesada y no puede eliminarse')
  }
  await repo.softDeleteRecepcion(id, eliminadoPor)
}

// ─── Adjuntos ──────────────────────────────────────────────────────────────

// Sube el Excel y en el mismo paso corre el motor de validación/carga
// (compras.md §7): lee el archivo con el Template de Carga de la Recepción,
// resuelve cada fila contra los maestros y, si hay OC, compara contra sus
// líneas. Todo o nada — si algo no cuadra, no se crea ningún pallet y la
// Recepción queda RECHAZADA con el detalle de diferencias.
export async function subirAdjunto(
  recepcionId: number,
  archivo: { nombre: string; mime: string; datos: Buffer },
  userId: string,
) {
  const recepcion = await obtenerRecepcion(recepcionId)
  // puedeModificarse ya cubre "sin pallets todavía" (relevante para
  // consignación, que se queda en CARGADA aunque ya haya generado stock).
  if (!(await puedeModificarse(recepcion))) {
    throw new ValidationError('La Recepción ya fue procesada y no admite nuevos adjuntos')
  }
  if (!MIMES_EXCEL_PERMITIDOS.has(archivo.mime)) {
    throw new ValidationError('Tipo de archivo no permitido. Se acepta solo Excel (.xlsx)')
  }
  if (archivo.datos.length > MAX_ADJUNTO_BYTES) {
    throw new ValidationError('El archivo supera el tamaño máximo de 10 MB')
  }

  const adjunto = await repo.createAdjunto(
    recepcionId,
    { nombre: archivo.nombre, mime: archivo.mime, tamano: archivo.datos.length },
    archivo.datos,
    userId,
  )

  const templateCarga = await repo.getTemplateCargaParaLectura(recepcion.templateCargaId ?? -1)

  try {
    const resultado = await procesarCargaExcel(
      { id: recepcion.id, ordenCompraId: recepcion.ordenCompraId, templateCargaId: recepcion.templateCargaId, templateCarga },
      archivo.datos,
    )
    return { adjunto, ...resultado, recepcion: shapeRecepcion(resultado.recepcion) }
  } catch (err) {
    // El adjunto ya se guardó (evidencia de qué se intentó cargar); lo único
    // que falta es dejar la Recepción en RECHAZADA para que quede claro que
    // este intento no generó pallets y habilitar el reintento.
    await repo.marcarRechazada(recepcionId)
    throw err
  }
}

export async function descargarAdjunto(recepcionId: number, adjuntoId: number) {
  // La Recepción se valida primero vía la consulta tenant-scoped
  // (obtenerRecepcion) — RecepcionAdjunto no es un modelo tenant, así que sin
  // esto un adjunto de otra empresa sería alcanzable si el atacante conoce
  // ambos IDs (mismo patrón que el hallazgo de adjuntos del lote Materiales).
  await obtenerRecepcion(recepcionId)
  const meta = await repo.getAdjuntoMeta(recepcionId, adjuntoId)
  if (!meta) throw new NotFoundError('Adjunto', String(adjuntoId))
  const contenido = await repo.getAdjuntoContenido(adjuntoId)
  if (!contenido) throw new NotFoundError('Adjunto', String(adjuntoId))
  return { meta, datos: contenido.datos }
}

export async function eliminarAdjunto(recepcionId: number, adjuntoId: number) {
  const recepcion = await obtenerRecepcion(recepcionId)
  if (!(await puedeModificarse(recepcion))) {
    throw new ValidationError('La Recepción ya fue procesada y no admite eliminar adjuntos')
  }
  const meta = await repo.getAdjuntoMeta(recepcionId, adjuntoId)
  if (!meta) throw new NotFoundError('Adjunto', String(adjuntoId))
  await repo.deleteAdjunto(adjuntoId)
}
