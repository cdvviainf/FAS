import { resolverOrdenCompra } from './resolvers/orden-compra.resolver.js'
import { ordenCompraPdfPayloadSchema } from './schemas/orden-compra.schema.js'
import { OrdenCompraV1 } from './templates/orden-compra/v1/index.js'
import { resolverInstructivoEmbalaje } from './resolvers/instructivo-embalaje.resolver.js'
import { instructivoEmbalajePdfPayloadSchema } from './schemas/instructivo-embalaje.schema.js'
import { InstructivoEmbalajeV1 } from './templates/instructivo-embalaje/v1/index.js'
import { resolverSolicitudInspeccion } from './resolvers/solicitud-inspeccion.resolver.js'
import { solicitudInspeccionPdfPayloadSchema } from './schemas/solicitud-inspeccion.schema.js'
import { SolicitudInspeccionV1 } from './templates/solicitud-inspeccion/v1/index.js'
import { resolverCierreComercial } from './resolvers/cierre-comercial.resolver.js'
import { cierreComercialPdfPayloadSchema } from './schemas/cierre-comercial.schema.js'
import { CierreComercialV1 } from './templates/cierre-comercial/v1/index.js'
import { resolverMovimiento, resolverMovimientoGuiaDespacho } from './resolvers/movimiento.resolver.js'
import { movimientoPdfPayloadSchema } from './schemas/movimiento.schema.js'
import { MovimientoV1 } from './templates/movimiento/v1/index.js'
import { MovimientoGuiaDespachoV1 } from './templates/movimiento-guia-despacho/v1/index.js'
import { resolverOrdenCompraMaterial } from './resolvers/orden-compra-material.resolver.js'
import { ordenCompraMaterialPdfPayloadSchema } from './schemas/orden-compra-material.schema.js'
import { OrdenCompraMaterialV1 } from './templates/orden-compra-material/v1/index.js'
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
    controlCopia: true,
    nombreArchivo: (p) => `OC_${p.numero}.pdf`,
    folio: (p) => p.numero,
  },
  'instructivo-embalaje': {
    titulo: 'Instructivo de Embalaje',
    resolver: resolverInstructivoEmbalaje,
    schema: instructivoEmbalajePdfPayloadSchema,
    plantillaActual: 'v1',
    plantillas: { v1: InstructivoEmbalajeV1 },
    pagina: { formato: 'A4', orientacion: 'landscape', margen: '14mm 12mm 16mm' },
    itemMenu: 'COMPRAS_INSTRUCTIVO',
    // Solo previsualizar y descargar, sin marca de agua — sin versión oficial
    // ni reimpresión (decisión de Christian, ciclo 2026-08-18).
    controlCopia: false,
    nombreArchivo: (p) => `Instructivo_${p.numero}.pdf`,
    folio: (p) => p.numero,
  },
  'solicitud-inspeccion': {
    titulo: 'Solicitud de Inspección',
    resolver: resolverSolicitudInspeccion,
    schema: solicitudInspeccionPdfPayloadSchema,
    plantillaActual: 'v1',
    plantillas: { v1: SolicitudInspeccionV1 },
    pagina: { formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' },
    // Any-of: LECTURA en cualquiera de los dos ítems habilita ver/descargar —
    // mismo criterio que ya usan las rutas de detalle de Solicitud
    // (solicitudes.routes.ts, ITEMS = [COMPRAS_SOLICITUDES, CAL_SOLICITUDES]).
    itemMenu: ['COMPRAS_SOLICITUDES', 'CAL_SOLICITUDES'],
    controlCopia: false,
    nombreArchivo: (p) => `${p.codigo}.pdf`,
    folio: (p) => p.codigo,
  },
  'cierre-comercial': {
    titulo: 'Cierre Comercial',
    resolver: resolverCierreComercial,
    schema: cierreComercialPdfPayloadSchema,
    plantillaActual: 'v1',
    plantillas: { v1: CierreComercialV1 },
    pagina: { formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' },
    itemMenu: 'VENTAS_NV',
    controlCopia: true,
    nombreArchivo: (p) => `CierreComercial_${p.folio}.pdf`,
    folio: (p) => p.folio,
  },
  'movimiento': {
    titulo: 'Movimiento de Materiales',
    resolver: resolverMovimiento,
    schema: movimientoPdfPayloadSchema,
    plantillaActual: 'v1',
    plantillas: { v1: MovimientoV1 },
    pagina: { formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' },
    itemMenu: 'OPER_MATERIALES',
    controlCopia: true,
    nombreArchivo: (p) => `${p.numero}.pdf`,
    folio: (p) => p.numero,
  },
  // Interna, no válida como DTE (Docs/agrosan_etapa4_motor_documentos.md §7)
  // — el gate de negocio (emiteDTE + CONFIRMADO) vive en el resolver.
  'movimiento-guia-despacho': {
    titulo: 'Guía de Despacho (interna)',
    resolver: resolverMovimientoGuiaDespacho,
    schema: movimientoPdfPayloadSchema,
    plantillaActual: 'v1',
    plantillas: { v1: MovimientoGuiaDespachoV1 },
    pagina: { formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' },
    itemMenu: 'OPER_MATERIALES',
    controlCopia: true,
    nombreArchivo: (p) => `GuiaDespacho_${p.numero}.pdf`,
    folio: (p) => p.numero,
  },
  'orden-compra-material': {
    titulo: 'Orden de Compra de Materiales',
    resolver: resolverOrdenCompraMaterial,
    schema: ordenCompraMaterialPdfPayloadSchema,
    plantillaActual: 'v1',
    plantillas: { v1: OrdenCompraMaterialV1 },
    pagina: { formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' },
    itemMenu: 'MATERIALES_OC',
    controlCopia: true,
    nombreArchivo: (p) => `OCM_${p.numero}.pdf`,
    folio: (p) => p.numero,
  },
}

export function getDocumentDefinition(tipo: string) {
  return DOCUMENT_REGISTRY[tipo]
}
