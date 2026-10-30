export type EstadoSolicitud = 'PENDIENTE' | 'NOTIFICADA' | 'APROBADA' | 'RECHAZADA' | 'OBJETADA'
export type ResultadoCierre = 'APROBADA' | 'RECHAZADA' | 'OBJETADA'
export type FuncionAsignado = 'ACUDIR' | 'NOTIFICAR'
export type EtapaAdjunto = 'CREACION' | 'CIERRE'
export type TipoInspeccion = 'PRODUCTO_TERMINADO' | 'PROCESO'

export const TIPO_INSPECCION_LABELS: Record<TipoInspeccion, string> = {
  PRODUCTO_TERMINADO: 'Producto Terminado',
  PROCESO: 'Proceso',
}

export const ESTADO_LABELS: Record<EstadoSolicitud, string> = {
  PENDIENTE: 'Pendiente',
  NOTIFICADA: 'Notificada',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  OBJETADA: 'Objetada',
}

export const RESULTADO_CIERRE_LABELS: Record<ResultadoCierre, string> = {
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  OBJETADA: 'Objetada',
}

export const FUNCION_LABELS: Record<FuncionAsignado, string> = {
  ACUDIR: 'Acudir',
  NOTIFICAR: 'Notificar',
}

export interface AsignadoInput {
  usuarioId: string
  funcion: FuncionAsignado
}

export interface SolicitudAsignado {
  id: number
  usuarioId: string
  funcion: FuncionAsignado
  usuario: { id: string; nombre: string; email: string }
}

export interface SolicitudAdjunto {
  id: number
  nombre: string
  mime: string
  tamano: number
  etapa: EtapaAdjunto
  subidoEn: string
  subidoPor: string
}

export interface SolicitudInspeccion {
  id: number
  numero: number
  codigo: string
  temporadaId: number
  temporada: { id: number; codigo: string; descripcion: string }
  usuarioSolicitanteId: string
  usuarioSolicitante: { id: string; nombre: string; email: string }
  entidadProductorId: number
  entidadProductor: { id: number; codigo: string; descripcion: string; razonSocial: string }
  plantaId: number | null
  planta: { id: number; codigo: string; descripcion: string; razonSocial: string } | null
  direccionId: number
  direccion: {
    id: number
    codigo: string
    descripcion: string
    direccion: string
    latitud: string | null
    longitud: string | null
    comuna: { id: number; descripcion: string } | null
    pais: { id: number; descripcion: string } | null
  }
  contactoId: number | null
  contacto: {
    id: number
    nombre: string
    email: string | null
    telefono: string | null
    whatsapp: string | null
    tipo: string | null
  } | null
  // Fecha de visita: nullable (2026-10-13) — se fija al editar la visita o en el cierre.
  fechaHora: string | null
  // Tipo de inspección (solo informativo): Producto Terminado o Proceso.
  tipoInspeccion: TipoInspeccion | null
  mercadoId: number | null
  mercado: { id: number; codigo: string; descripcion: string } | null
  clienteId: number | null
  cliente: { id: number; codigo: string; descripcion: string; razonSocial: string } | null
  fechaDespacho: string | null
  paises: { pais: { id: number; codigo: string; descripcion: string } }[]
  // Detalle de producto por línea (2026-10-27): reemplaza especie única y las
  // listas planas de cabecera.
  lineas: SolicitudLinea[]
  observaciones: string | null
  estado: EstadoSolicitud
  notificadaEn: string | null
  comentariosCierre: string | null
  fechaCierre: string | null
  cerradaPor: string | null
  creadoEn: string
  creadoPor: string
  asignados: SolicitudAsignado[]
  adjuntos: SolicitudAdjunto[]
  // Defectos registrados en el cierre (2026-10-13).
  defectos: SolicitudDefecto[]
  // Características de madurez/calidad capturadas en el cierre (2026-10-26).
  madurez: SolicitudMadurez[]
}

// Línea de producto de la solicitud (2026-10-27).
export interface SolicitudLinea {
  id: number
  cantidadPallets: number | null
  especie: { id: number; codigo: string; descripcion: string }
  variedad: { id: number; codigo: string; descripcion: string }
  articulo: { id: number; codigo: string; descripcion: string }
  categorias: { categoria: { id: number; codigo: string; descripcion: string } }[]
  calibres: { calibre: { id: number; codigo: string; descripcion: string } }[]
  calidades: { notaCalidad: { id: number; codigo: string; descripcion: string }; notaCondicion: { id: number; codigo: string; descripcion: string } }[]
}

export interface SolicitudLineaInput {
  especieId: number
  articuloId: number
  variedadId: number
  categoriaIds?: number[]
  calibreIds?: number[]
  calidadesPermitidas?: { notaCalidadId: number; notaCondicionId: number }[]
  cantidadPallets?: number | null
}

export type TipoDatoMadurez = 'DECIMAL' | 'PORCENTAJE' | 'ENTERO' | 'TEXTO'

export interface SolicitudMadurez {
  id: number
  caracteristicaId: number
  valorNumerico: string | null
  valorTexto: string | null
  caracteristica: {
    id: number
    codigo: string
    descripcion: string
    tipoDato: TipoDatoMadurez
    unidad: { id: number; codigo: string; descripcion: string } | null
  }
}

export interface SolicitudMadurezInput {
  caracteristicaId: number
  valorNumerico?: number | null
  valorTexto?: string | null
}

export type TipoMedidaDefecto = 'UNIDADES' | 'PORCENTAJE'

export interface SolicitudDefecto {
  id: number
  grupoDefectoId: number
  defectoId: number
  valor: string
  grupoDefecto: { id: number; codigo: string; descripcion: string }
  defecto: { id: number; codigo: string; descripcion: string; tipoMedida: TipoMedidaDefecto }
}

export interface SolicitudDefectoInput {
  grupoDefectoId: number
  defectoId: number
  valor: number
}

export interface SolicitudCreateInput {
  temporadaId: number
  usuarioSolicitanteId: string
  entidadProductorId: number
  plantaId?: number | null
  direccionId: number
  contactoId?: number | null
  // Opcional (2026-10-13): la fecha de visita ya no se ingresa al crear.
  fechaHora?: string | null
  mercadoId?: number | null
  paisIds?: number[]
  clienteId?: number | null
  fechaDespacho?: string | null
  tipoInspeccion?: TipoInspeccion | null
  // Detalle de producto por línea (2026-10-27). Mínimo una línea.
  lineas: SolicitudLineaInput[]
  observaciones?: string | null
  asignados: AsignadoInput[]
}

export type SolicitudUpdateInput = Partial<Omit<SolicitudCreateInput, 'temporadaId'>>

export interface SolicitudCerrarInput {
  comentarios: string
  resultado: ResultadoCierre
  // Fecha/hora de la visita (se ingresa/edita en el cierre). Opcional solo si la
  // solicitud ya la tenía fijada; el backend exige una fecha efectiva.
  fechaHora?: string | null
  // Asignados (incluye a quién asiste = ACUDIR): REEMPLAZA el set, obligatorio.
  asignados: AsignadoInput[]
  // Defectos registrados en la visita.
  defectos?: SolicitudDefectoInput[]
  // Características de madurez/calidad (reemplaza el set completo).
  caracteristicas?: SolicitudMadurezInput[]
}

export interface SolicitudListResponse {
  data: SolicitudInspeccion[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface SolicitudListFilters {
  q?: string
  page?: number
  limit?: number
  estado?: EstadoSolicitud
  temporadaId?: number
  entidadProductorId?: number
  usuarioAsignadoId?: string
  fechaDesde?: string
  fechaHasta?: string
}
