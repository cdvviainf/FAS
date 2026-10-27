export interface MantenedorRef {
  id: number
  codigo: string
  descripcion: string
}

export interface EntidadRef {
  id: number
  codigo: string
  descripcion: string
  razonSocial: string
}

export interface UsuarioRef {
  id: string
  nombre: string
  email: string
}

export type EstadoOrdenCompra = 'BORRADOR' | 'EMITIDA' | 'RECEPCIONADA'

export const ESTADO_OC_LABELS: Record<EstadoOrdenCompra, string> = {
  BORRADOR: 'Borrador',
  EMITIDA: 'Emitida',
  RECEPCIONADA: 'Recepcionada',
}

// Modalidad de compra (2026-10-23): CAJAS (fruta embalada) o GRANEL (por kilos).
export type ModalidadCompra = 'CAJAS' | 'GRANEL'

export const MODALIDAD_COMPRA_LABELS: Record<ModalidadCompra, string> = {
  CAJAS: 'Cajas',
  GRANEL: 'Granel',
}

export interface OrdenCompraLineaItem {
  id: number
  especieId: number
  especie: MantenedorRef
  variedadId: number
  variedad: MantenedorRef
  // categoría/cajas nullable desde la modalidad GRANEL (2026-10-23): en granel
  // la línea solo lleva cantidadKilos/precioUsdKilo.
  categoriaId: number | null
  categoria: MantenedorRef | null
  articuloId: number
  articulo: MantenedorRef & { etiqueta: MantenedorRef | null; kgNetoEnvase: string | null; kgBrutoEnvase: string | null }
  // Etiqueta de la línea (2026-10-15).
  etiquetaId: number | null
  etiqueta: MantenedorRef | null
  calibres: { calibre: MantenedorRef }[]
  tipoPalletId: number | null
  tipoPallet: MantenedorRef | null
  cantidadPallets: number | null
  cajasPorPallet: number | null
  cajas: number | null
  precioUsdCaja: string | null
  // Modalidad GRANEL: kilos comprados y precio USD por kilo.
  cantidadKilos: string | null
  precioUsdKilo: string | null
  // Línea tomada de una línea del Cierre Comercial (2026-08-23) — ver
  // NotaVentaDetalleDisponibilidad más abajo.
  notaVentaDetalleId: number | null
}

// Línea del Cierre Comercial con su disponible ya calculado — alimenta la
// grilla de selección al armar una OC contra un Cierre (2026-08-23).
export interface NotaVentaDetalleDisponibilidad {
  id: number
  especieId: number
  especie: MantenedorRef
  variedadId: number
  variedad: MantenedorRef
  categoriaId: number | null
  categoria: MantenedorRef | null
  articuloId: number
  articulo: MantenedorRef
  // Etiqueta (Marca) resuelta en el Cierre — se usa como valor inicial al tomar
  // la línea en la OC (editable).
  etiquetaId: number | null
  etiqueta: MantenedorRef | null
  tipoPalletId: number | null
  tipoPallet: MantenedorRef | null
  cajasPorPallet: number
  cajas: number
  calibres: { calibre: MantenedorRef }[]
  cajasComprometidas: number
  cajasDisponibles: number
}

export type FechaReferenciaPago = 'FACTURA' | 'ZARPE' | 'ENVIO_DOCUMENTOS' | 'ARRIBO'
export type TipoValorCuota = 'PORCENTAJE' | 'MONTO_UNITARIO'

export interface OrdenCompraCuotaPagoItem {
  id: number
  fechaReferencia: FechaReferenciaPago
  plazoDias: number
  tipoValor: TipoValorCuota
  porcentaje: string | null
  valorUnitario: string | null
  monedaId: number | null
  moneda: MantenedorRef | null
  unidadId: number | null
  unidad: MantenedorRef | null
  montoCalculado: string | null
  descripcion: string | null
}

export interface CondicionPagoRef {
  id: number
  codigo: string
  descripcion: string
}

export interface OrdenCompraListItem {
  id: number
  numero: string
  fecha: string
  estado: EstadoOrdenCompra
  modalidad: ModalidadCompra
  entidadProductorId: number
  entidadProductor: EntidadRef
  moneda: MantenedorRef
  notaVenta: { id: number; folio: number } | null
}

export interface OrdenCompraSolicitudVinculo {
  id: number
  solicitudInspeccion: { id: number; codigo: string; estado: string }
}

export interface OrdenCompraDetalle extends OrdenCompraListItem {
  monedaId: number
  notaVentaId: number | null
  // N:M (2026-08-22, Etapa 2) — reemplaza solicitudInspeccionId/solicitudInspeccion singular.
  solicitudes: OrdenCompraSolicitudVinculo[]
  formaPagoId: number | null
  formaPago: MantenedorRef | null
  condicionPagoId: number | null
  condicionPago: CondicionPagoRef | null
  destinoMercadoId: number | null
  destinoMercado: MantenedorRef | null
  responsableId: string | null
  responsable: UsuarioRef | null
  incotermId: number | null
  incoterm: MantenedorRef | null
  observaciones: string | null
  // Condiciones comerciales de compra a GRANEL (2026-10-27). Null en CAJAS.
  porcentajeMinExportacion: string | null
  modalidadEntregaGranel: 'PUESTA_EN_CAMPO' | 'ENTREGADA_EN_PLANTA' | null
  envasesProporcionadosPor: 'PRODUCTOR' | 'EXPORTADORA' | null
  encargadoDescartePor: 'PRODUCTOR' | 'EXPORTADORA' | null
  lineas: OrdenCompraLineaItem[]
  cuotasPago: OrdenCompraCuotaPagoItem[]
  creadoEn: string
  creadoPor: string
}

export interface OrdenCompraListResponse {
  data: OrdenCompraListItem[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface OrdenCompraLineaInput {
  especieId: number
  variedadId: number
  articuloId: number
  // Campos de modalidad CAJAS (opcionales en el input porque no aplican en
  // GRANEL). El backend los exige según la modalidad de la OC. La etiqueta la
  // resuelve el backend si el artículo tiene etiqueta fija (2026-10-15).
  categoriaId?: number | null
  etiquetaId?: number | null
  calibreIds?: number[]
  tipoPalletId?: number | null
  cantidadPallets?: number | null
  cajasPorPallet?: number | null
  cajas?: number | null
  precioUsdCaja?: number | null
  // Campos de modalidad GRANEL (2026-10-23): kilos + precio USD por kilo.
  cantidadKilos?: number | null
  precioUsdKilo?: number | null
}

export interface OrdenCompraLineaCreateInput extends OrdenCompraLineaInput {
  // Línea tomada de una línea del Cierre Comercial (2026-08-23) — solo al
  // crear, no se reasigna en un PATCH.
  notaVentaDetalleId?: number | null
}

export interface OrdenCompraCreateInput {
  entidadProductorId: number
  // Modalidad de compra (2026-10-23): CAJAS (default) o GRANEL.
  modalidad?: ModalidadCompra
  notaVentaId?: number | null
  // N:M (2026-08-22, Etapa 2): ≥1 requerido al crear (validate() en el form
  // lo exige); opcional en el update — si no viene, se conservan los
  // vínculos existentes.
  solicitudInspeccionIds?: number[]
  fecha?: string
  formaPagoId?: number | null
  condicionPagoId?: number | null
  monedaId: number
  destinoMercadoId?: number | null
  responsableId?: string | null
  incotermId?: number | null
  observaciones?: string | null
  // Condiciones comerciales de compra a GRANEL (2026-10-27).
  porcentajeMinExportacion?: number | null
  modalidadEntregaGranel?: 'PUESTA_EN_CAMPO' | 'ENTREGADA_EN_PLANTA' | null
  envasesProporcionadosPor?: 'PRODUCTOR' | 'EXPORTADORA' | null
  encargadoDescartePor?: 'PRODUCTOR' | 'EXPORTADORA' | null
}

export type OrdenCompraUpdateInput = Partial<OrdenCompraCreateInput> & {
  estado?: EstadoOrdenCompra
}
