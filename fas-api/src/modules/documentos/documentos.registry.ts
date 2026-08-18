import { resolverOrdenCompra } from './resolvers/orden-compra.resolver.js'
import { ordenCompraPdfPayloadSchema } from './schemas/orden-compra.schema.js'
import { OrdenCompraV1 } from './templates/orden-compra/v1/index.js'
import type { DocumentRegistry } from './documentos.types.js'

// Registro central — Etapa 4 §4: "un solo lugar donde se declara todo".
// Agregar un documento nuevo del catálogo (Etapa 4 §2) es agregar una
// entrada acá; nada más del motor cambia.
export const DOCUMENT_REGISTRY: DocumentRegistry = {
  'orden-compra': {
    titulo: 'Orden de Compra',
    resolver: resolverOrdenCompra,
    schema: ordenCompraPdfPayloadSchema,
    plantillaActual: 'v1',
    plantillas: { v1: OrdenCompraV1 },
    pagina: { formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' },
    itemMenu: 'COMPRAS_OC',
    nombreArchivo: (p) => `OC_${p.numero}.pdf`,
    folio: (p) => p.numero,
  },
}

export function getDocumentDefinition(tipo: string) {
  return DOCUMENT_REGISTRY[tipo]
}
