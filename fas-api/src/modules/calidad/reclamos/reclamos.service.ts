import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './reclamos.repository.js'
import type {
  AnalisisCalidadInput,
  CerrarInput,
  DocumentoArchivo,
  ProvisionInput,
  ReclamoCreateInput,
  ReclamoListFilters,
  ReclamoUpdateInput,
  ValorizarInput,
} from './reclamos.types.js'

// Cualquier archivo digital (RC-D13: "documentos libres, sin spec") — el
// único límite es el tamaño. 10 MB, mismo tope que Recepción.
const MAX_DOCUMENTO_BYTES = 10 * 1024 * 1024

// ─── Reclamo ────────────────────────────────────────────────────────────────

// IMP-QA-R1-023: además de los pallets/líneas candidatas, trae cliente y
// moneda del Embarque (heredados, no editables) para que el diálogo de
// creación los muestre.
export async function obtenerLineasReclamables(embarqueId: number) {
  const embarque = await repo.getEmbarqueParaReclamo(embarqueId)
  if (!embarque) throw new NotFoundError('Embarque', String(embarqueId))
  const pallets = await repo.getLineasReclamables(embarqueId)
  return { cliente: embarque.notaVenta.cliente, moneda: embarque.notaVenta.moneda, pallets }
}

// clienteId/monedaId se heredan del Embarque (vía su Nota de Venta) — no
// vienen en el body, no son editables después (reclamos.md RC-D4).
export async function crearReclamo(embarqueId: number, body: ReclamoCreateInput, creadoPor: string) {
  const embarque = await repo.getEmbarqueParaReclamo(embarqueId)
  if (!embarque) throw new NotFoundError('Embarque', String(embarqueId))

  return repo.crearReclamoTransaccional(
    {
      embarqueId,
      clienteId: embarque.notaVenta.clienteId,
      monedaId: embarque.notaVenta.monedaId,
      fechaReclamo: body.fechaReclamo,
      resumenCliente: body.resumenCliente,
      temporadaId: body.temporadaId,
      lineas: body.lineas,
    },
    body.provision,
    creadoPor,
  )
}

// IMP-QA-R1-019: edición de cabecera/líneas mientras no esté CERRADO — el
// claim atómico (existe + no cerrado) y la revalidación R-NEW1/R-NEW2 viven
// en el repository (misma transacción que la escritura).
export async function actualizarReclamo(id: number, embarqueId: number, body: ReclamoUpdateInput, userId: string) {
  return repo.actualizarReclamoTransaccional(id, embarqueId, body, userId)
}

export async function listarReclamosPorEmbarque(embarqueId: number) {
  return repo.listReclamosPorEmbarque(embarqueId)
}

export async function listarReclamos(filters: ReclamoListFilters) {
  const { page = 1, limit = 20 } = filters
  const { data, total } = await repo.listReclamos(filters)
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function obtenerReclamo(id: number) {
  const reclamo = await repo.getReclamoById(id)
  if (!reclamo) throw new NotFoundError('Reclamo', String(id))
  return reclamo
}

// El claim (existe + no CERRADO -> 403, R9/CA10) vive en el repository,
// atómico en la misma escritura — IMP-QA-R1-021 (antes no chequeaba estado).
export async function actualizarAnalisisCalidad(id: number, body: AnalisisCalidadInput, userId: string) {
  return repo.updateAnalisisCalidad(id, body.comentarioCalidad, userId)
}

// R6: valorConfirmado >= 0 (validado en el schema). Reversa solas las
// Provisiones VIGENTE del reclamo (ver repo — efecto de sistema, no manual).
export async function valorizarReclamo(id: number, body: ValorizarInput, userId: string) {
  return repo.valorizarReclamoTransaccional(id, body.valorConfirmado, userId)
}

// R5b/R5 (IMP-QA-R1-020): solo se puede cerrar desde VALORIZADO — el
// repository distingue "ya cerrado" (403) de "todavía no valorizado" (422).
export async function cerrarReclamo(id: number, body: CerrarInput, userId: string) {
  return repo.cerrarReclamo(id, body.procedencia, userId)
}

export async function reabrirReclamo(id: number, userId: string) {
  return repo.reabrirReclamo(id, userId)
}

// ─── Documentos ─────────────────────────────────────────────────────────────

export async function subirDocumento(reclamoId: number, archivo: DocumentoArchivo, userId: string) {
  if (archivo.datos.length > MAX_DOCUMENTO_BYTES) {
    throw new ValidationError('El archivo supera el tamaño máximo de 10 MB')
  }
  return repo.createDocumento(
    reclamoId,
    { nombre: archivo.nombre, mime: archivo.mime, tamano: archivo.datos.length },
    archivo.datos,
    userId,
  )
}

export async function descargarDocumento(reclamoId: number, documentoId: number) {
  const meta = await repo.getDocumentoMeta(reclamoId, documentoId)
  if (!meta) throw new NotFoundError('Documento', String(documentoId))
  const contenido = await repo.getDocumentoContenido(documentoId)
  if (!contenido) throw new NotFoundError('Documento', String(documentoId))
  return { meta, datos: contenido.datos }
}

export async function eliminarDocumento(reclamoId: number, documentoId: number, userId: string) {
  const meta = await repo.getDocumentoMeta(reclamoId, documentoId)
  if (!meta) throw new NotFoundError('Documento', String(documentoId))
  await repo.deleteDocumento(reclamoId, documentoId, userId)
}

// ─── API externa (sin sesión FAS, 2026-09-08) ──────────────────────────────
// Mismas funciones de lectura que arriba — la diferencia de autenticación
// (requireReclamosApiKey vs. requireAuth+requireLevel) vive en las rutas,
// no acá.

// Resuelve el tenant del Reclamo ANTES de setear el contexto (ver repo) —
// el controller lo llama primero y recién después setea empresaContext.
export async function resolverEmpresaDeReclamo(reclamoId: number): Promise<number> {
  const empresaId = await repo.getEmpresaIdDeReclamo(reclamoId)
  if (empresaId == null) throw new NotFoundError('Reclamo', String(reclamoId))
  return empresaId
}

export async function listarDocumentosExterno(reclamoId: number) {
  const reclamo = await repo.getReclamoById(reclamoId)
  if (!reclamo) throw new NotFoundError('Reclamo', String(reclamoId))
  return reclamo.documentos
}

export const descargarDocumentoExterno = descargarDocumento

// ─── Provisiones ────────────────────────────────────────────────────────────

export async function crearProvision(reclamoId: number, body: ProvisionInput, userId: string) {
  return repo.crearProvision(reclamoId, body, userId)
}

export async function listarProvisiones(reclamoId: number) {
  await obtenerReclamo(reclamoId)
  return repo.listProvisiones(reclamoId)
}

// PR3: cualquier usuario con permiso puede reversar, pero no quien la creó
// (chequeo manual — la reversa automática al valorizar no pasa por acá, ver
// repo.valorizarReclamoTransaccional). R9 (IMP-QA-R1-021): también exige que
// el Reclamo padre no esté CERRADO — lo valida atómicamente el repository.
export async function reversarProvision(id: number, userId: string) {
  const provision = await repo.getProvisionById(id)
  if (!provision) throw new NotFoundError('Provisión', String(id))
  if (provision.estado === 'REVERSADA') throw new ValidationError('La Provisión ya está reversada')
  if (provision.creadoPorId === userId) {
    throw new ValidationError('No puedes reversar una Provisión que tú mismo creaste (PR3)')
  }
  return repo.reversarProvision(id, provision.reclamoId, userId)
}
