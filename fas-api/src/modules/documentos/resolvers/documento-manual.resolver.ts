import { NotFoundError } from '../../../shared/errors.js'
import { getDocumentoManualById } from '../../finanzas/generador-dte/generador-dte.repository.js'
import { getEmpresaParaDocumento, getEntidadParaDocumento } from '../documentos.repository.js'
import { logoDataUri } from '../documentos.repository.js'
import type { DocumentoManualPdfPayload } from '../schemas/documento-manual.schema.js'

const CLASE_LABELS: Record<string, string> = {
  FACTURA_NACIONAL: 'Factura Nacional',
  GUIA_DESPACHO: 'Guía de Despacho',
  NOTA_CREDITO: 'Nota de Crédito',
  NOTA_DEBITO: 'Nota de Débito',
}

const TIPO_DTE_LABELS: Record<number, string> = {
  33: 'Factura Electrónica (33)',
  34: 'Factura Exenta Electrónica (34)',
  52: 'Guía de Despacho Electrónica (52)',
  56: 'Nota de Débito Electrónica (56)',
  61: 'Nota de Crédito Electrónica (61)',
}

const ESTADO_LABELS: Record<string, string> = {
  BORRADOR: 'Borrador',
  ENVIADA_SII: 'Enviada al SII',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  ANULADA: 'Anulada',
}

const IND_TRASLADO_LABELS: Record<number, string> = {
  1: 'Venta',
  2: 'Venta por efectuar',
  3: 'Consignación',
  4: 'Entrega gratuita',
  5: 'Traslado interno',
  6: 'Otros traslados no venta',
  7: 'Guía de devolución',
  8: 'Traslado para exportación',
  9: 'Venta para exportación',
}

const COD_REF_LABELS: Record<number, string> = {
  1: 'Anula documento',
  2: 'Corrige texto',
  3: 'Corrige monto',
}

function juntar(dir: string | null | undefined, comuna: string | null | undefined): string | null {
  const partes = [dir?.trim(), comuna?.trim()].filter((p) => p && p.length > 0)
  return partes.length > 0 ? partes.join(', ') : null
}

// Resolver del Documento Manual (Generador DTE) — snapshot para previsualizar el
// borrador. id = id del DocumentoManual.
export async function resolverDocumentoManual(id: number, empresaId: number): Promise<DocumentoManualPdfPayload> {
  const doc = await getDocumentoManualById(id)
  if (!doc) throw new NotFoundError('Documento', String(id))

  const [empresa, receptorEntidad] = await Promise.all([
    getEmpresaParaDocumento(empresaId),
    getEntidadParaDocumento(doc.entidadId),
  ])

  const esGuia = doc.claseDocumento === 'GUIA_DESPACHO'
  const esNotaRef = doc.claseDocumento === 'NOTA_CREDITO' || doc.claseDocumento === 'NOTA_DEBITO'

  const transporte = esGuia
    ? {
        indTraslado: doc.guiaIndTraslado != null ? (IND_TRASLADO_LABELS[doc.guiaIndTraslado] ?? String(doc.guiaIndTraslado)) : '—',
        transportista: doc.guiaTransporte?.razonSocial ?? doc.guiaTransporte?.descripcion ?? null,
        chofer: doc.guiaChoferNombre ?? null,
        choferRut: doc.guiaChoferRut ?? null,
        patenteCamion: doc.guiaPatenteCamion ?? null,
        patenteRemolque: doc.guiaPatenteRemolque ?? null,
        origen: juntar(doc.guiaDirOrigen, doc.guiaComunaOrigen),
        destino: juntar(doc.guiaDirDestino, doc.guiaComunaDestino),
      }
    : null

  const referencias = esNotaRef
    ? doc.referencias.map((r) => ({
        tipoDocRef: r.tipoDocRef,
        folioRef: r.folioRef,
        fechaRef: r.fechaRef.toISOString(),
        codRef: r.codRef != null ? (COD_REF_LABELS[r.codRef] ?? String(r.codRef)) : null,
        razonRef: r.razonRef,
      }))
    : []

  const claseLabel = CLASE_LABELS[doc.claseDocumento] ?? doc.claseDocumento

  return {
    empresa: {
      razonSocial: empresa?.razonSocial ?? '—',
      rut: empresa?.rut ?? null,
      direccion: empresa?.direcciones[0]?.direccion ?? null,
      logoDataUri: logoDataUri(empresa?.logo),
    },
    receptor: {
      razonSocial: doc.entidad.razonSocial,
      descripcion: doc.entidad.descripcion,
      rut: receptorEntidad?.identificador ?? doc.entidad.identificador ?? null,
    },
    codigo: doc.codigo,
    claseLabel,
    tituloDocumento: `${claseLabel} — ${TIPO_DTE_LABELS[doc.tipoDte] ?? `DTE ${doc.tipoDte}`}`,
    tipoDte: doc.tipoDte,
    fecha: doc.fechaDocumento.toISOString(),
    estado: ESTADO_LABELS[doc.estado] ?? doc.estado,
    moneda: doc.moneda.codigo,
    condicionPago: doc.condicionPago?.descripcion ?? null,
    observaciones: doc.observaciones,
    transporte,
    referencias,
    lineas: doc.lineas.map((l) => ({
      descripcion: l.descripcion,
      cantidad: l.cantidad.toString(),
      precioUnitario: l.precioUnitario.toString(),
      monto: l.montoLinea.toString(),
      exento: l.exento,
    })),
    totales: {
      neto: doc.montoNeto.toString(),
      exento: doc.montoExento.toString(),
      iva: doc.montoIva.toString(),
      total: doc.montoTotal.toString(),
    },
  }
}
