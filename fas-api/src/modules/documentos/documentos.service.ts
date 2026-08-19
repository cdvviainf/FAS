import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createHash } from 'node:crypto'
import { NotFoundError, ValidationError } from '../../shared/errors.js'
import { renderPdf } from '../../shared/pdf/render.js'
import { getDocumentDefinition } from './documentos.registry.js'
import * as repo from './documentos.repository.js'
import { fmt } from './ui/formato.js'

function getDefinicionOFallar(tipo: string) {
  const def = getDocumentDefinition(tipo)
  if (!def) throw new NotFoundError('Tipo de documento', tipo)
  return def
}

async function resolverYValidar(tipo: string, id: number, empresaId: number) {
  const def = getDefinicionOFallar(tipo)
  const payload = await def.resolver(id, empresaId)
  const parsed = def.schema.safeParse(payload)
  if (!parsed.success) {
    // No debería pasar en producción (el resolver ya arma el shape del
    // schema) — si pasa, es un desalineamiento entre resolver y schema que
    // hay que corregir en código, no un error de datos del usuario.
    throw new ValidationError('El payload resuelto no cumple el schema del documento', { issues: parsed.error.issues })
  }
  return { def, payload: parsed.data }
}

function armarHtml(
  def: ReturnType<typeof getDefinicionOFallar>,
  payload: unknown,
  version: string,
  marcaAgua?: 'BORRADOR' | 'COPIA',
  marcaAguaFecha?: string,
): string {
  const Plantilla = def.plantillas[version]
  if (!Plantilla) throw new NotFoundError('Versión de plantilla', version)
  const markup = renderToStaticMarkup(createElement(Plantilla, { d: payload, marcaAgua, marcaAguaFecha }))
  return `<!DOCTYPE html>${markup}`
}

// ─── Preview (Etapa 4 §1 — "el preview es el PDF") ────────────────────────
// Mismo HTML que se fotografía para el PDF; se sirve crudo para mostrarlo en
// un iframe en el ERP antes de emitir. Siempre con marca BORRADOR — nada
// generado por esta vía queda registrado como oficial.
export async function obtenerPreviewHtml(tipo: string, id: number, empresaId: number): Promise<string> {
  const { def, payload } = await resolverYValidar(tipo, id, empresaId)
  return armarHtml(def, payload, def.plantillaActual, def.controlCopia ? 'BORRADOR' : undefined)
}

// ─── PDF bajo demanda (sin emitir) ─────────────────────────────────────────
export async function obtenerPdf(tipo: string, id: number, empresaId: number): Promise<{ buffer: Buffer; nombreArchivo: string }> {
  const { def, payload } = await resolverYValidar(tipo, id, empresaId)
  const html = armarHtml(def, payload, def.plantillaActual, def.controlCopia ? 'BORRADOR' : undefined)
  const buffer = await renderPdf(html, def.pagina)
  return { buffer, nombreArchivo: def.nombreArchivo(payload) }
}

// Hash de idempotencia — DOC-QA-003 (ronda 1): tiene que ser del PAYLOAD
// (más versión de plantilla), no del PDF renderizado. Dos renders de un
// mismo payload no son necesariamente bit a bit idénticos (Chromium puede
// variar metadata interna entre ejecuciones), así que un hash del PDF nunca
// detectaría "es la misma emisión" de forma confiable.
// JSON.stringify plano (no un canonicalizador con sort de keys): el payload
// sale siempre del mismo resolver, que arma el objeto literal con el mismo
// orden de propiedades en cada llamada — alcanza para esta etapa.
function hashPayload(payload: unknown, plantillaVersion: string): string {
  return createHash('sha256').update(`${plantillaVersion}:${JSON.stringify(payload)}`).digest('hex')
}

// ─── Emisión (Etapa 4 §4 — snapshot congelado) ────────────────────────────
// Congela el payload + la versión de plantilla vigente en documentos_emitidos.
// Idempotente de verdad (DOC-QA-003, ronda 2), no por mejor esfuerzo:
// - Fast-path optimista fuera de lock (getDocumentoEmitidoPorHash): si ya
//   existe una emisión con exactamente este hash (payload+plantilla), ni
//   siquiera se renderiza — cubre el caso común sin el costo de abrir
//   Chromium.
// - crearDocumentoEmitidoIdempotente (documentos.repository.ts) es la
//   autoridad final: bajo advisory lock, relee y solo entonces inserta —
//   dos POST /emitir concurrentes para el mismo documento no duplican fila,
//   la constraint única del modelo es la defensa en profundidad.
export async function emitirDocumento(
  tipo: string,
  id: number,
  empresaId: number,
  creadoPor: string,
): Promise<{ id: number; buffer: Buffer; nombreArchivo: string }> {
  const { def, payload } = await resolverYValidar(tipo, id, empresaId)
  // Defensa en profundidad — documentos.routes.ts ya bloquea /emitir para un
  // `tipo` sin control de copia (404 antes de llegar acá); este segundo
  // chequeo evita que un llamado directo al service (ej. un test futuro)
  // deje un Instructivo o una Solicitud con documentos_emitidos, que no
  // deberían tener ese concepto.
  if (!def.controlCopia) {
    throw new ValidationError('Este documento no admite emisión oficial')
  }
  const hashSha256 = hashPayload(payload, def.plantillaActual)

  const previo = await repo.getDocumentoEmitidoPorHash(tipo, id, def.plantillaActual, hashSha256)
  if (previo) {
    return { id: previo.id, buffer: Buffer.from(previo.pdf), nombreArchivo: def.nombreArchivo(payload) }
  }

  const html = armarHtml(def, payload, def.plantillaActual, undefined)
  const buffer = await renderPdf(html, def.pagina)

  const emitido = await repo.crearDocumentoEmitidoIdempotente({
    tipo,
    documentoId: id,
    plantillaVersion: def.plantillaActual,
    folio: def.folio(payload),
    payload,
    pdf: buffer,
    hashSha256,
    creadoPor,
  })

  return { id: emitido.id, buffer: Buffer.from(emitido.pdf), nombreArchivo: def.nombreArchivo(payload) }
}

// ─── Reimpresión (Etapa 4 §4 — "un documento emitido no puede cambiar después") ──
// Nunca vuelve a resolver desde la base: usa el payload y la versión de
// plantilla que quedaron congelados al emitir, con marca COPIA.
export async function obtenerPdfEmitido(documentoEmitidoId: number): Promise<{ buffer: Buffer; nombreArchivo: string }> {
  const emitido = await repo.getDocumentoEmitidoById(documentoEmitidoId)
  if (!emitido) throw new NotFoundError('Documento emitido', String(documentoEmitidoId))
  const def = getDefinicionOFallar(emitido.tipo)
  const marcaAguaFecha = `Reimpreso el ${fmt.fechaHora(new Date().toISOString())}`
  const html = armarHtml(def, emitido.payload, emitido.plantillaVersion, 'COPIA', marcaAguaFecha)
  const buffer = await renderPdf(html, def.pagina)
  return { buffer, nombreArchivo: def.nombreArchivo(emitido.payload as never) }
}
