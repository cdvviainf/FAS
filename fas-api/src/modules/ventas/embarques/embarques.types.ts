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
  naviera?: string | null
  nave?: string | null
  numeroContenedor?: string | null
  fechaZarpe?: Date | null
  fechaRetiroPlanta?: Date | null
}

export interface ReservarPalletsInput {
  palletIds: number[]
}
