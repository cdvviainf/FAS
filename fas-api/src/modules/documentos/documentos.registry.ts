import { resolverOrdenCompra } from './resolvers/orden-compra.resolver.js'
import { ordenCompraPdfPayloadSchema } from './schemas/orden-compra.schema.js'
import { OrdenCompraV1 } from './templates/orden-compra/v1/index.js'
import { OrdenCompraV2 } from './templates/orden-compra/v2/index.js'
import { OrdenCompraV3 } from './templates/orden-compra/v3/index.js'
import { resolverInstructivoEmbalaje } from './resolvers/instructivo-embalaje.resolver.js'
import { instructivoEmbalajePdfPayloadSchema } from './schemas/instructivo-embalaje.schema.js'
import { InstructivoEmbalajeV1 } from './templates/instructivo-embalaje/v1/index.js'
import { InstructivoEmbalajeV2 } from './templates/instructivo-embalaje/v2/index.js'
import { resolverSolicitudInspeccion } from './resolvers/solicitud-inspeccion.resolver.js'
import { solicitudInspeccionPdfPayloadSchema } from './schemas/solicitud-inspeccion.schema.js'
import { SolicitudInspeccionV1 } from './templates/solicitud-inspeccion/v1/index.js'
import { SolicitudInspeccionV2 } from './templates/solicitud-inspeccion/v2/index.js'
import { SolicitudInspeccionV3 } from './templates/solicitud-inspeccion/v3/index.js'
import { resolverCierreComercial } from './resolvers/cierre-comercial.resolver.js'
import { cierreComercialPdfPayloadSchema } from './schemas/cierre-comercial.schema.js'
import { CierreComercialV1 } from './templates/cierre-comercial/v1/index.js'
import { CierreComercialV2 } from './templates/cierre-comercial/v2/index.js'
import { CierreComercialV3 } from './templates/cierre-comercial/v3/index.js'
import { CierreComercialV4 } from './templates/cierre-comercial/v4/index.js'
import { resolverMovimiento, resolverMovimientoGuiaDespacho } from './resolvers/movimiento.resolver.js'
import { movimientoPdfPayloadSchema } from './schemas/movimiento.schema.js'
import { MovimientoV1 } from './templates/movimiento/v1/index.js'
import { MovimientoV2 } from './templates/movimiento/v2/index.js'
import { MovimientoGuiaDespachoV1 } from './templates/movimiento-guia-despacho/v1/index.js'
import { MovimientoGuiaDespachoV2 } from './templates/movimiento-guia-despacho/v2/index.js'
import { resolverOrdenCompraMaterial } from './resolvers/orden-compra-material.resolver.js'
import { ordenCompraMaterialPdfPayloadSchema } from './schemas/orden-compra-material.schema.js'
import { OrdenCompraMaterialV1 } from './templates/orden-compra-material/v1/index.js'
import { OrdenCompraMaterialV2 } from './templates/orden-compra-material/v2/index.js'
import { resolverInstructivoEmbarque } from './resolvers/instructivo-embarque.resolver.js'
import { instructivoEmbarquePdfPayloadSchema } from './schemas/instructivo-embarque.schema.js'
import { InstructivoEmbarqueV1 } from './templates/instructivo-embarque/v1/index.js'
import { InstructivoEmbarqueV2 } from './templates/instructivo-embarque/v2/index.js'
import { InstructivoEmbarqueV3 } from './templates/instructivo-embarque/v3/index.js'
import { InstructivoEmbarqueV4 } from './templates/instructivo-embarque/v4/index.js'
import { resolverProforma } from './resolvers/proforma.resolver.js'
import { resolverFacturaExportacion } from './resolvers/factura-exportacion.resolver.js'
import { proformaPdfPayloadSchema } from './schemas/proforma.schema.js'
import { ProformaV1 } from './templates/proforma/v1/index.js'
import { generarProformaExcel } from './excel/proforma.excel.js'
import { ProformaV2 } from './templates/proforma/v2/index.js'
import { ProformaV3 } from './templates/proforma/v3/index.js'
import { resolverFichaProductor } from './resolvers/ficha-productor.resolver.js'
import { fichaProductorPdfPayloadSchema } from './schemas/ficha-productor.schema.js'
import { FichaProductorV1 } from './templates/ficha-productor/v1/index.js'
import { FichaProductorV2 } from './templates/ficha-productor/v2/index.js'
import { resolverSolicitudPago } from './resolvers/solicitud-pago.resolver.js'
import { solicitudPagoPdfPayloadSchema } from './schemas/solicitud-pago.schema.js'
import { SolicitudPagoV1 } from './templates/solicitud-pago/v1/index.js'
import { resolverProformaProductor } from './resolvers/proforma-productor.resolver.js'
import { proformaProductorPdfPayloadSchema } from './schemas/proforma-productor.schema.js'
import { ProformaProductorV1 } from './templates/proforma-productor/v1/index.js'
import { ProformaProductorV2 } from './templates/proforma-productor/v2/index.js'
import { ProformaProductorV3 } from './templates/proforma-productor/v3/index.js'
import { resolverProformaMaterial } from './resolvers/proforma-material.resolver.js'
import { proformaMaterialPdfPayloadSchema } from './schemas/proforma-material.schema.js'
import { ProformaMaterialV1 } from './templates/proforma-material/v1/index.js'
import { ProformaMaterialV2 } from './templates/proforma-material/v2/index.js'
import { ProformaMaterialV3 } from './templates/proforma-material/v3/index.js'
import { resolverDocumentoManual } from './resolvers/documento-manual.resolver.js'
import { documentoManualPdfPayloadSchema } from './schemas/documento-manual.schema.js'
import { DocumentoManualV1 } from './templates/documento-manual/v1/index.js'
import { DocumentoManualV2 } from './templates/documento-manual/v2/index.js'
import type { DocumentRegistry } from './documentos.types.js'

// Registro central — Etapa 4 §4: "un solo lugar donde se declara todo".
// Agregar un documento nuevo del catálogo (Etapa 4 §2) es agregar una
// entrada acá; nada más del motor cambia.
export const DOCUMENT_REGISTRY: DocumentRegistry = {
  'ficha-productor': {
    titulo: 'Ficha de Productor',
    resolver: resolverFichaProductor,
    schema: fichaProductorPdfPayloadSchema,
    plantillaActual: 'v2',
    // v2 = cabecera corporativa (2026-11-08, plantilla propia); v1 congelada para reimpresiones.
    plantillas: { v1: FichaProductorV1, v2: FichaProductorV2 },
    pagina: { formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' },
    // Mismo ítem que gatea el listado/ficha del productor (productores.routes.ts).
    itemMenu: 'PROD_FICHA',
    // Datos maestros — una sola versión, sin emisión oficial (ver Instructivo/Solicitud).
    controlCopia: false,
    nombreArchivo: (p) => `Ficha_${p.productor.codigo}.pdf`,
    folio: (p) => p.productor.codigo,
  },
  'solicitud-pago': {
    titulo: 'Solicitud de Pago a Productor',
    resolver: resolverSolicitudPago,
    schema: solicitudPagoPdfPayloadSchema,
    plantillaActual: 'v1',
    plantillas: { v1: SolicitudPagoV1 },
    pagina: { formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' },
    itemMenu: 'PROD_SOLICITUD_PAGO',
    controlCopia: false,
    nombreArchivo: (p) => `${p.numero}.pdf`,
    folio: (p) => p.numero,
  },
  'proforma-productor': {
    titulo: 'Proforma de Servicios a Productor',
    resolver: resolverProformaProductor,
    schema: proformaProductorPdfPayloadSchema,
    plantillaActual: 'v3',
    // v3 = Tipo de documento + vencimiento estimado por cuota (2026-11-09); v2 =
    // cabecera corporativa (2026-11-08); v1/v2 congeladas para reimpresiones.
    plantillas: { v1: ProformaProductorV1, v2: ProformaProductorV2, v3: ProformaProductorV3 },
    pagina: { formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' },
    itemMenu: 'PRODUCTORES_PROFORMA',
    // Previsualización para revisar antes de aceptar/rechazar — sin emisión oficial.
    controlCopia: false,
    nombreArchivo: (p) => `${p.numero}.pdf`,
    folio: (p) => p.numero,
  },
  'proforma-material': {
    titulo: 'Proforma de Venta de Materiales',
    resolver: resolverProformaMaterial,
    schema: proformaMaterialPdfPayloadSchema,
    plantillaActual: 'v3',
    // v3 = Tipo de documento + vencimiento estimado por cuota (2026-11-09); v2 =
    // cabecera corporativa (2026-11-08); v1/v2 congeladas para reimpresiones.
    plantillas: { v1: ProformaMaterialV1, v2: ProformaMaterialV2, v3: ProformaMaterialV3 },
    pagina: { formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' },
    itemMenu: 'MATERIALES_PROFORMA',
    controlCopia: false,
    nombreArchivo: (p) => `${p.numero}.pdf`,
    folio: (p) => p.numero,
  },
  // Generador DTE — documento manual (2026-11-04). Previsualización de borrador
  // para las 4 clases (Factura Nacional, Guía de Despacho, Nota de Crédito/Débito).
  'documento-manual': {
    titulo: 'Documento Manual (Generador DTE)',
    resolver: resolverDocumentoManual,
    schema: documentoManualPdfPayloadSchema,
    plantillaActual: 'v2',
    // v2 = cabecera corporativa (2026-11-08, plantilla propia); v1 congelada para reimpresiones.
    plantillas: { v1: DocumentoManualV1, v2: DocumentoManualV2 },
    pagina: { formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' },
    itemMenu: 'GENERADOR_DTE',
    controlCopia: false,
    nombreArchivo: (p) => `${p.codigo}.pdf`,
    folio: (p) => p.codigo,
  },
  'orden-compra': {
    titulo: 'Orden de Compra',
    resolver: resolverOrdenCompra,
    schema: ordenCompraPdfPayloadSchema,
    // v2 (2026-10-26): banner + bilingüe. v3 (2026-11-06): formato corporativo
    // + hoja de Términos por empresa + numeración de páginas. v1/v2 se
    // conservan para reimpresiones de OC ya emitidas con esa versión (regla de
    // versionado, Etapa 4 §4).
    plantillaActual: 'v3',
    plantillas: { v1: OrdenCompraV1, v2: OrdenCompraV2, v3: OrdenCompraV3 },
    pagina: { formato: 'A4', orientacion: 'portrait', margen: '10mm 10mm 14mm' },
    itemMenu: 'COMPRAS_OC',
    controlCopia: true,
    nombreArchivo: (p) => `OC_${p.numero}.pdf`,
    folio: (p) => p.numero,
  },
  'instructivo-embalaje': {
    titulo: 'Instructivo de Embalaje',
    resolver: resolverInstructivoEmbalaje,
    schema: instructivoEmbalajePdfPayloadSchema,
    plantillaActual: 'v2',
    // v2 = cabecera corporativa (2026-11-08, plantilla propia); v1 congelada para reimpresiones.
    plantillas: { v1: InstructivoEmbalajeV1, v2: InstructivoEmbalajeV2 },
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
    plantillaActual: 'v3',
    // v2 = cabecera corporativa (2026-11-08); v3 = resultado por línea en tabla
    // (un defecto/indicador por fila) + Servicio Tercero (2026-11-10). v1/v2 congeladas.
    plantillas: { v1: SolicitudInspeccionV1, v2: SolicitudInspeccionV2, v3: SolicitudInspeccionV3 },
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
    // v2 (2026-11-06): formato corporativo "Sales Order", bilingüe. v1 se
    // conserva para reimpresiones (regla de versionado, Etapa 4 §4).
    plantillaActual: 'v4',
    // v3 = cabecera corporativa única (2026-11-08); v4 = Calidad / Condición por
    // línea (2026-11-09). v1–v3 se conservan para reimpresiones.
    plantillas: { v1: CierreComercialV1, v2: CierreComercialV2, v3: CierreComercialV3, v4: CierreComercialV4 },
    pagina: { formato: 'A4', orientacion: 'portrait', margen: '10mm 10mm 14mm' },
    itemMenu: 'VENTAS_NV',
    controlCopia: true,
    nombreArchivo: (p) => `CierreComercial_${p.folio}.pdf`,
    folio: (p) => p.folio,
  },
  'movimiento': {
    titulo: 'Movimiento de Materiales',
    resolver: resolverMovimiento,
    schema: movimientoPdfPayloadSchema,
    plantillaActual: 'v2',
    // v2 = cabecera corporativa (2026-11-08, plantilla propia); v1 congelada para reimpresiones.
    plantillas: { v1: MovimientoV1, v2: MovimientoV2 },
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
    plantillaActual: 'v2',
    // v2 = cabecera corporativa (2026-11-08, plantilla propia); v1 congelada para reimpresiones.
    plantillas: { v1: MovimientoGuiaDespachoV1, v2: MovimientoGuiaDespachoV2 },
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
    plantillaActual: 'v2',
    // v2 = cabecera corporativa (2026-11-08, plantilla propia); v1 congelada para reimpresiones.
    plantillas: { v1: OrdenCompraMaterialV1, v2: OrdenCompraMaterialV2 },
    pagina: { formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' },
    itemMenu: 'MATERIALES_OC',
    controlCopia: true,
    nombreArchivo: (p) => `OCM_${p.numero}.pdf`,
    folio: (p) => p.numero,
  },
  'instructivo-embarque': {
    titulo: 'Instructivo de Embarque',
    resolver: resolverInstructivoEmbarque,
    schema: instructivoEmbarquePdfPayloadSchema,
    plantillaActual: 'v4',
    // v2 = cabecera corporativa (2026-11-08, plantilla propia); v3 = todos los
    // Notify del Cliente (2026-11-10); v4 = formato corporativo "Shipping
    // Instruction" ES/EN (2026-11-11). v1–v3 congeladas para reimpresiones.
    plantillas: { v1: InstructivoEmbarqueV1, v2: InstructivoEmbarqueV2, v3: InstructivoEmbarqueV3, v4: InstructivoEmbarqueV4 },
    pagina: { formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' },
    itemMenu: 'VENTAS_EMBARQUES',
    // Un documento por InstructivoHijo (Planta), regenerable en cualquier
    // momento desde la pestaña "Generar Instructivos" — sin distinción
    // borrador/oficial, mismo criterio que Instructivo de Embalaje.
    controlCopia: false,
    nombreArchivo: (p) => `Instructivo_${p.codigo}.pdf`,
    folio: (p) => p.codigo,
  },
  'proforma': {
    titulo: 'Proforma de Exportación',
    resolver: resolverProforma,
    schema: proformaPdfPayloadSchema,
    plantillaActual: 'v3',
    // v2 = cabecera corporativa (2026-11-08, plantilla propia); v1 congelada para reimpresiones.
    // v3 (2026-11-12): Exportador = EXPORTADORA de la NV + contactos documentales.
    plantillas: { v1: ProformaV1, v2: ProformaV2, v3: ProformaV3 },
    pagina: { formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' },
    itemMenu: 'FACT_EXPORTACION',
    // Control de copia (2026-11-07, supersede el criterio anterior "sin
    // distinción"): como OC y Cierre, la vista previa/descarga sale con la
    // etiqueta BORRADOR, "Emitir documento" congela el PDF oficial en
    // documentos_emitidos y las reimpresiones salen como COPIA. El estado de
    // negocio de la Proforma (EMITIDA/ANULADA) no cambia al emitir el PDF.
    controlCopia: true,
    nombreArchivo: (p) => `Proforma_${p.codigo}.pdf`,
    folio: (p) => p.codigo,
    // Misma Proforma en Excel (2026-11-12), desde el mismo payload.
    excel: { generar: generarProformaExcel, nombreArchivo: (p) => `Proforma_${p.codigo}.xlsx` },
  },
  // Factura COMERCIAL (documento interno, formato propio) — NO es la
  // representación tributaria del DTE 110 (esa la entrega LibreDTE, pendiente de
  // integrar). El XML timbrado sí es el artefacto oficial (descarga aparte).
  'factura-exportacion': {
    titulo: 'Factura Comercial de Exportación',
    resolver: resolverFacturaExportacion,
    schema: proformaPdfPayloadSchema, // misma forma de payload que la Proforma
    plantillaActual: 'v2',
    // reusa la plantilla (variante='FACTURA'); v2 = cabecera corporativa (2026-11-08).
    plantillas: { v1: ProformaV1, v2: ProformaV2 },
    pagina: { formato: 'A4', orientacion: 'portrait', margen: '14mm 12mm 16mm' },
    itemMenu: 'FACT_EXPORTACION',
    controlCopia: false,
    nombreArchivo: (p) => `FacturaComercial_${p.codigo}.pdf`,
    folio: (p) => p.codigo,
  },
}

export function getDocumentDefinition(tipo: string) {
  return DOCUMENT_REGISTRY[tipo]
}
