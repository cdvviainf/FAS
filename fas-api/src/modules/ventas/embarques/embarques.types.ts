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
  // Información base por contenedor (2026-09-30) — uno por Embarque a crear,
  // en el mismo orden. Ver DatosContenedorInput.
  contenedores?: DatosContenedorInput[]
}

// Temperatura/CBM/Tipo de BL de UN contenedor, capturados al solicitar la
// reserva (en vez de solo después, vía guardarDatosReservaBase) — para poder
// incluirlos en el envío a AGL360 (temperatura/cbm) y persistirlos en el
// Embarque desde su creación.
export interface DatosContenedorInput {
  temperatura?: number | null
  cbm?: number | null
  tipoBlId?: number | null
}

export interface DatosReservaManualInput {
  numeroBooking?: string | null
  nave?: string | null
  numeroContenedor?: string | null
  fechaZarpe?: Date | null
}

export interface ReservarPalletsInput {
  palletIds: number[]
}

// Información base de la reserva (2026-09-28) — datos propios del Embarque.
export interface DatosReservaBaseInput {
  fechaCompromiso?: Date | null
  temperatura?: number | null
  cbm?: number | null
  tipoBlId?: number | null
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
  // Rangos de stacking (ventas.md R11, 2026-09-22) — reemplaza siempre el
  // conjunto completo (delete-then-create), nunca un rango individual.
  // `undefined` = no tocar los rangos existentes; `[]` = borrarlos todos.
  stackingRangos?: StackingRangoInput[]
  observacionesInstructivo?: string | null
}

export interface StackingRangoInput {
  desde: Date
  hasta: Date
}

export interface InstructivoHijoUpdateInput {
  fechaCargaPlanta?: Date | null
  observaciones?: string | null
}
