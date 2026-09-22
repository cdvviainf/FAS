export interface EmbarqueCreateInput {
  notaVentaId: number
  // Gestor Logístico elegido (2026-09-07, ventas.md §4.3) — determina si se
  // intenta la reserva automática (Integración activa vinculada) o si el
  // Embarque nace directo en modo manual.
  gestorLogisticoId: number
  // true = el usuario ya vio que la integración automática falló y decidió
  // generar el Embarque igual, sin reintentar la Solicitud de Reserva
  // (ventas.md §4.3) — el Embarque nace `estadoReserva=PENDIENTE`.
  forzarSinReserva?: boolean
}

export interface DatosReservaManualInput {
  numeroBooking?: string | null
  nave?: string | null
  numeroContenedor?: string | null
  fechaZarpe?: Date | null
  fechaRetiroPlanta?: Date | null
}

export interface ReservarPalletsInput {
  palletIds: number[]
}

// Datos del Instructivo de Embarque compartidos por todo el Embarque
// (ventas.md R11 + gap analysis contra el Instructivo real del cliente) —
// independiente de reservaManual, editable siempre desde la pestaña "Generar
// Instructivos". `navieraId` reemplaza el texto libre que antes vivía en
// DatosReservaManualInput — misma Entidad, ya no duplicada.
export interface DatosInstructivoInput {
  puertoZarpeId?: number | null
  voyageNumber?: string | null
  deposito?: string | null
  awbBl?: string | null
  cutoffDate?: Date | null
  tipoBultos?: string | null
  agenteAduanaId?: number | null
  embarcadorId?: number | null
  navieraId?: number | null
  fechaArribo?: Date | null
  stackingDesde?: Date | null
  stackingHasta?: Date | null
  observacionesInstructivo?: string | null
}

export interface InstructivoHijoUpdateInput {
  fechaCargaPlanta?: Date | null
  observaciones?: string | null
}
