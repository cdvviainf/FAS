import type { DimensionProforma, ProformaLineaInput } from './proforma.types.js'

export type { DimensionProforma, ProformaLineaInput }

export type EstadoFacturaExportacion = 'BORRADOR' | 'APROBADA' | 'RECHAZADA' | 'ANULADA'

export interface FacturaExportacionActualizarInput {
  dimensiones: DimensionProforma[]
  lineas: ProformaLineaInput[]
  idioma?: 'ES' | 'EN'
  fechaDocumento?: string | null
  // Flete/Seguro de la cláusula de venta — exigidos según los flags de la
  // cláusula (Parametro.requiereFlete/requiereSeguro). El service los valida.
  montoFlete?: number | null
  montoSeguro?: number | null
  // Tipo de cambio (pesos por unidad de la moneda extranjera) — editable en BORRADOR.
  tipoCambio?: number | null
  // Fecha de la paridad observada (ISO YYYY-MM-DD) cuando el valor viene de
  // "Obtener"; null en ingreso manual. BRT-R1-003.
  fechaTipoCambio?: string | null
  observaciones?: string | null
}

export interface FacturasExportacionListFilters {
  page?: number
  limit?: number
  embarqueId?: number
  clienteId?: number
  estado?: EstadoFacturaExportacion
  // Busca sobre embarque.numeroInstructivo (mismo criterio que Proforma/reclamos).
  folio?: string
}
