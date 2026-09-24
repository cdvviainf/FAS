import type { DimensionProforma, ProformaLineaInput } from './proforma.types.js'

export type { DimensionProforma, ProformaLineaInput }

export type EstadoFacturaExportacion = 'BORRADOR' | 'EMITIDA' | 'ANULADA'

export interface FacturaExportacionActualizarInput {
  dimensiones: DimensionProforma[]
  lineas: ProformaLineaInput[]
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
