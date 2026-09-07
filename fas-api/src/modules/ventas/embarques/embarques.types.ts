export interface EmbarqueCreateInput {
  notaVentaId: number
  // true = el usuario ya vio que la integración con AGL360 falló y decidió
  // generar el Embarque igual, sin reintentar la Solicitud de Reserva
  // (ventas.md §4.3) — el Embarque nace `estadoReserva=PENDIENTE`.
  forzarSinReserva?: boolean
}

export interface ReservarPalletsInput {
  palletIds: number[]
}
