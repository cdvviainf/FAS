import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import { obtenerPdf } from '../../documentos/documentos.service.js'
import * as repo from './generador-dte.repository.js'
import type {
  ClaseDocumentoManual,
  DocumentoManualCreateInput,
  DocumentoManualLineaInput,
  DocumentoManualTransporteInput,
  DocumentoManualUpdateInput,
  DocumentoManualListFilters,
} from './generador-dte.types.js'

// ─── Validaciones de referencias compartidas (crear/editar) ──────────────────────

async function validarReceptor(entidadId: number) {
  const entidad = await repo.getEntidad(entidadId)
  if (!entidad) throw new ValidationError('El receptor no existe o no está activo')
  return entidad
}

async function validarMoneda(monedaId: number) {
  const moneda = await repo.getMoneda(monedaId)
  if (!moneda) throw new ValidationError('La moneda seleccionada no es válida')
}

async function validarCondicionPago(condicionPagoId: number) {
  const cp = await repo.getCondicionPago(condicionPagoId)
  if (!cp) throw new ValidationError('La condición de pago no existe')
  if (cp.tipo !== 'VENTA') throw new ValidationError('La condición de pago debe ser de tipo Venta')
}

async function validarLineas(lineas: DocumentoManualLineaInput[]) {
  for (const l of lineas) {
    if (l.articuloId != null) {
      const art = await repo.getArticulo(l.articuloId)
      if (!art) throw new ValidationError('Un artículo del detalle no existe en esta empresa')
      if (!art.activo) throw new ValidationError('Un artículo del detalle está inactivo')
    }
  }
}

async function validarTransporte(t: DocumentoManualTransporteInput) {
  if (t.choferChileno && !t.choferRut?.trim()) {
    throw new ValidationError('El RUT del chofer es obligatorio para choferes chilenos')
  }
  if (t.transporteId != null) {
    const transporte = await repo.getEntidad(t.transporteId)
    if (!transporte) throw new ValidationError('El transportista no existe o no está activo')
    if (!transporte.tipos.includes('EMPRESA_TRANSPORTE')) {
      throw new ValidationError('El transportista seleccionado no es una Empresa de Transporte')
    }
  }
}

// Valida todos los datos de un documento según su clase (crear = clase del body;
// editar = clase persistida).
async function validarPorClase(
  clase: ClaseDocumentoManual,
  d: { entidadId?: number; monedaId?: number; condicionPagoId?: number | null; lineas?: DocumentoManualLineaInput[]; transporte?: DocumentoManualTransporteInput | null },
) {
  if (d.entidadId != null) await validarReceptor(d.entidadId)
  if (d.monedaId != null) await validarMoneda(d.monedaId)
  if (clase === 'FACTURA_NACIONAL' && d.condicionPagoId != null) await validarCondicionPago(d.condicionPagoId)
  if (d.lineas != null) await validarLineas(d.lineas)
  if (clase === 'GUIA_DESPACHO' && d.transporte != null) await validarTransporte(d.transporte)
}

// ─── Casos de uso ─────────────────────────────────────────────────────────────

export async function listarDocumentosManuales(f: DocumentoManualListFilters) {
  const { data, total } = await repo.listDocumentosManuales(f)
  return {
    data,
    meta: { total, page: f.page, limit: f.limit, totalPages: Math.ceil(total / f.limit) },
  }
}

export async function obtenerDocumentoManual(id: number) {
  const doc = await repo.getDocumentoManualById(id)
  if (!doc) throw new NotFoundError('Documento', String(id))
  return doc
}

export async function crearDocumentoManual(data: DocumentoManualCreateInput, creadoPorId: string) {
  await validarPorClase(data.claseDocumento, data)
  return repo.createDocumentoManual(data, creadoPorId)
}

export async function actualizarDocumentoManual(id: number, data: DocumentoManualUpdateInput) {
  const actual = await repo.getDocumentoManualById(id)
  if (!actual) throw new NotFoundError('Documento', String(id))
  if (actual.estado !== 'BORRADOR') throw new ValidationError('Solo se puede editar un documento en estado Borrador')
  const clase = actual.claseDocumento as ClaseDocumentoManual
  // No permitir dejar una NC/ND sin referencias al editar (replace-all).
  if ((clase === 'NOTA_CREDITO' || clase === 'NOTA_DEBITO') && data.referencias !== undefined && data.referencias.length === 0) {
    throw new ValidationError('La Nota de Crédito/Débito requiere al menos un documento de referencia')
  }
  // No permitir dejar una Guía sin tipo de traslado.
  if (clase === 'GUIA_DESPACHO' && data.transporte !== undefined && (data.transporte == null || !data.transporte.indTraslado)) {
    throw new ValidationError('La Guía de Despacho requiere los datos de transporte (tipo de traslado)')
  }
  await validarPorClase(clase, data)
  return repo.updateDocumentoManual(id, data)
}

export async function anularDocumentoManual(id: number, eliminadoPor: string) {
  return repo.anularDocumentoManual(id, eliminadoPor)
}

// PDF de previsualización (borrador) — reusa el motor de documentos.
export async function obtenerPdfBorrador(id: number) {
  const doc = await repo.getDocumentoManualById(id)
  if (!doc) throw new NotFoundError('Documento', String(id))
  const empresaId = getEmpresaIdActual()
  if (empresaId == null) throw new ValidationError('No hay empresa activa en la sesión')
  const idioma = doc.idioma === 'EN' ? 'EN' : 'ES'
  return obtenerPdf('documento-manual', id, empresaId, idioma)
}
