import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './reclamos.repository.js'
import { findPrefijoCodigoByModelo } from '../../config/prefijos-codigo/prefijos-codigo.repository.js'
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

  await validarTipoReclamo(body.tipoReclamoId)

  // Correlativo propio (2026-10-06) vía PrefijoCodigo (modelo='reclamo'). Si la
  // empresa no configuró su prefijo, se usa el default REC + 4 dígitos (mismo
  // criterio que el backfill de la migración).
  const prefijoConfig = await findPrefijoCodigoByModelo('reclamo')
  const prefijo = prefijoConfig?.prefijo ?? 'REC'
  const digitos = prefijoConfig?.digitos ?? 4

  return repo.crearReclamoTransaccional(
    {
      embarqueId,
      clienteId: embarque.notaVenta.clienteId,
      monedaId: embarque.notaVenta.monedaId,
      tipoReclamoId: body.tipoReclamoId,
      fechaReclamo: body.fechaReclamo,
      resumenCliente: body.resumenCliente,
      temporadaId: body.temporadaId,
      lineas: body.lineas,
    },
    body.provision,
    creadoPor,
    prefijo,
    digitos,
  )
}

// Valida que el tipo de reclamo exista (tenant) y no esté bloqueado.
async function validarTipoReclamo(tipoReclamoId: number) {
  const tipo = await repo.getTipoReclamoActivo(tipoReclamoId)
  if (!tipo) throw new ValidationError('El tipo de reclamo seleccionado no existe')
  if (tipo.bloqueado) throw new ValidationError('El tipo de reclamo seleccionado está bloqueado')
}

// IMP-QA-R1-019: edición de cabecera/líneas mientras no esté CERRADO — el
// claim atómico (existe + no cerrado) y la revalidación R-NEW1/R-NEW2 viven
// en el repository (misma transacción que la escritura).
export async function actualizarReclamo(id: number, embarqueId: number, body: ReclamoUpdateInput, userId: string) {
  if (body.tipoReclamoId != null) await validarTipoReclamo(body.tipoReclamoId)
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

// BRT-R2-004: la separación Calidad/Comercial no puede depender de que el
// cliente mande `soloConAnalisis`. Un usuario SIN el ítem de Comercial
// (VENTAS_RECLAMOS) solo puede ver/operar reclamos cuyo tipo genera análisis;
// `soloAnalizables` lo deriva el controller del permiso efectivo, no del query.
function reclamoNoAnalizableEsInvisible(reclamo: { tipoReclamo: { generaAnalisisCalidad: boolean } | null }) {
  return !reclamo.tipoReclamo?.generaAnalisisCalidad
}

export async function obtenerReclamo(id: number, soloAnalizables = false) {
  const reclamo = await repo.getReclamoById(id)
  if (!reclamo) throw new NotFoundError('Reclamo', String(id))
  // Para un usuario solo-Calidad, un reclamo comercial es como si no existiera
  // (404, no 403 — no revela su existencia).
  if (soloAnalizables && reclamoNoAnalizableEsInvisible(reclamo)) {
    throw new NotFoundError('Reclamo', String(id))
  }
  return reclamo
}

// El claim (existe + no CERRADO -> 403, R9/CA10) vive en el repository,
// atómico en la misma escritura — IMP-QA-R1-021 (antes no chequeaba estado).
export async function actualizarAnalisisCalidad(id: number, body: AnalisisCalidadInput, userId: string) {
  // Clasificación (GrupoDefecto) y líneas de defecto (2026-10-06): validar que
  // grupo/defecto existan (tenant) y que cada defecto pertenezca a su grupo.
  if (body.grupoDefectoId != null) {
    const grupo = await repo.getGrupoDefectoActivo(body.grupoDefectoId)
    if (!grupo) throw new ValidationError('El grupo de defecto (clasificación) seleccionado no existe o está bloqueado')
  }
  if (body.defectos !== undefined) {
    for (const [i, linea] of body.defectos.entries()) {
      const prefijo = `Defecto ${i + 1}:`
      const grupo = await repo.getGrupoDefectoActivo(linea.grupoDefectoId)
      if (!grupo) throw new ValidationError(`${prefijo} el grupo seleccionado no existe o está bloqueado`)
      const defecto = await repo.getDefectoActivo(linea.defectoId)
      if (!defecto) throw new ValidationError(`${prefijo} el defecto seleccionado no existe o está bloqueado`)
      if (defecto.grupoDefectoId !== linea.grupoDefectoId) {
        throw new ValidationError(`${prefijo} el defecto no pertenece al grupo seleccionado`)
      }
    }
  }
  // BRT-R2-004: el requisito "el tipo genera análisis" lo impone el repo DENTRO
  // del claim atómico (no un SELECT previo) — así Comercial no puede reclasificar
  // el tipo entre chequeo y escritura. Análisis es acción exclusiva de Calidad.
  return repo.updateAnalisisCalidad(id, body.comentarioCalidad, userId, body.grupoDefectoId, body.defectos)
}

// R6: valorConfirmado >= 0 (validado en el schema). Reversa solas las
// Provisiones VIGENTE del reclamo (ver repo — efecto de sistema, no manual).
// `soloAnalizables` (usuario sin VENTAS_RECLAMOS) viaja al claim atómico del repo.
export async function valorizarReclamo(id: number, body: ValorizarInput, userId: string, soloAnalizables = false) {
  return repo.valorizarReclamoTransaccional(id, body.valorConfirmado, userId, soloAnalizables)
}

// R5b/R5 (IMP-QA-R1-020): solo se puede cerrar desde VALORIZADO — el
// repository distingue "ya cerrado" (403) de "todavía no valorizado" (422).
export async function cerrarReclamo(id: number, body: CerrarInput, userId: string, soloAnalizables = false) {
  return repo.cerrarReclamo(id, body.procedencia, userId, soloAnalizables)
}

export async function reabrirReclamo(id: number, userId: string, soloAnalizables = false) {
  return repo.reabrirReclamo(id, userId, soloAnalizables)
}

// Anular Valorización (2026-09-23): vuelve el Reclamo a INGRESADO y restaura
// las Provisiones que la valorización había reversado automáticamente.
export async function anularValorizacion(id: number, userId: string, soloAnalizables = false) {
  return repo.anularValorizacionTransaccional(id, userId, soloAnalizables)
}

// ─── Documentos ─────────────────────────────────────────────────────────────

export async function subirDocumento(reclamoId: number, archivo: DocumentoArchivo, userId: string) {
  if (archivo.datos.length > MAX_DOCUMENTO_BYTES) {
    throw new ValidationError('El archivo supera el tamaño máximo de 10 MB')
  }
  // BRT-R2-004: adjuntar documentación es una acción de Calidad; el requisito de
  // tipo analizable se impone atómicamente en el claim del repo.
  return repo.createDocumento(
    reclamoId,
    { nombre: archivo.nombre, mime: archivo.mime, tamano: archivo.datos.length },
    archivo.datos,
    userId,
  )
}

export async function descargarDocumento(reclamoId: number, documentoId: number, soloAnalizables = false) {
  if (soloAnalizables) await asegurarReclamoAnalizable(reclamoId)
  const meta = await repo.getDocumentoMeta(reclamoId, documentoId)
  if (!meta) throw new NotFoundError('Documento', String(documentoId))
  const contenido = await repo.getDocumentoContenido(documentoId)
  if (!contenido) throw new NotFoundError('Documento', String(documentoId))
  return { meta, datos: contenido.datos }
}

export async function eliminarDocumento(reclamoId: number, documentoId: number, userId: string) {
  const meta = await repo.getDocumentoMeta(reclamoId, documentoId)
  if (!meta) throw new NotFoundError('Documento', String(documentoId))
  // BRT-R2-004: el requisito de tipo analizable se impone atómicamente en el
  // claim del repo (deleteDocumento), no en un chequeo previo.
  await repo.deleteDocumento(reclamoId, documentoId, userId)
}

// Carga el reclamo y exige que su tipo genere análisis de Calidad — comparte el
// criterio con actualizarAnalisisCalidad (reclamos comerciales no admiten
// trabajo de Calidad). BRT-R2-004.
async function asegurarReclamoAnalizable(reclamoId: number) {
  const reclamo = await repo.getReclamoById(reclamoId)
  if (!reclamo) throw new NotFoundError('Reclamo', String(reclamoId))
  if (reclamoNoAnalizableEsInvisible(reclamo)) {
    throw new ValidationError('Este tipo de reclamo no admite trabajo de Calidad')
  }
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

export async function crearProvision(reclamoId: number, body: ProvisionInput, userId: string, soloAnalizables = false) {
  // BRT-R2-004: el scope viaja al claim atómico del repo (crearProvision).
  return repo.crearProvision(reclamoId, body, userId, soloAnalizables)
}

export async function listarProvisiones(reclamoId: number, soloAnalizables = false) {
  // Reusa el scope de obtenerReclamo: un usuario solo-Calidad no lee provisiones
  // de un reclamo comercial (404). BRT-R2-004.
  await obtenerReclamo(reclamoId, soloAnalizables)
  return repo.listProvisiones(reclamoId)
}

// PR3: cualquier usuario con permiso puede reversar, pero no quien la creó
// (chequeo manual — la reversa automática al valorizar no pasa por acá, ver
// repo.valorizarReclamoTransaccional). R9 (IMP-QA-R1-021): también exige que
// el Reclamo padre no esté CERRADO — lo valida atómicamente el repository.
export async function reversarProvision(id: number, userId: string, soloAnalizables = false) {
  const provision = await repo.getProvisionById(id)
  if (!provision) throw new NotFoundError('Provisión', String(id))
  if (provision.estado === 'REVERSADA') throw new ValidationError('La Provisión ya está reversada')
  if (provision.creadoPorId === userId) {
    throw new ValidationError('No puedes reversar una Provisión que tú mismo creaste (PR3)')
  }
  // BRT-R2-004: el scope (tipo analizable para usuarios solo-Calidad) se impone
  // atómicamente en el claim del repo (reversarProvision), no en un SELECT previo.
  return repo.reversarProvision(id, provision.reclamoId, userId, soloAnalizables)
}
