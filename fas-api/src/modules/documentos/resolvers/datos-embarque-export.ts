import { getEmbarqueParaDocumentoExport, getPesosEmbarque } from '../documentos.repository.js'

// Notify / Consignatario resueltos para el PDF (razón social + id tributario +
// dirección por defecto).
export interface EntidadEmbarqueExport {
  razonSocial: string
  rut: string | null
  direccion: string | null
}

// Datos de transporte/exportación de un Embarque listos para la Proforma y la
// Factura de Exportación (DTE 110). Todos opcionales: un Embarque puede no
// tener reserva/booking aún, o un documento puede no tener Embarque asociado
// (en cuyo caso resolverDatosEmbarqueExport devuelve null).
export interface DatosEmbarqueExport {
  nave: string | null
  via: string | null
  blAwb: string | null
  tipoBl: string | null
  booking: string | null
  contenedor: string | null
  sello: string | null
  puertoEmbarque: string | null
  puertoDestino: string | null
  etd: string | null // ISO
  eta: string | null // ISO
  flete: string | null
  modalidadVenta: string | null
  incoterm: string | null
  notify: EntidadEmbarqueExport | null
  consignatario: EntidadEmbarqueExport | null
  pesoNeto: number | null
  pesoBruto: number | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function mapEntidad(
  e: { razonSocial: string; identificador: string | null; taxId: string | null; direcciones: { direccion: string }[] } | null,
): EntidadEmbarqueExport | null {
  if (!e) return null
  return {
    razonSocial: e.razonSocial,
    // Cliente/entidad extranjera: se prefiere el TAXID (fallback a identificador
    // para entidades creadas antes del campo TAXID).
    rut: e.taxId ?? e.identificador ?? null,
    direccion: e.direcciones[0]?.direccion ?? null,
  }
}

// Resuelve los datos de transporte/exportación de un Embarque para el PDF.
// Devuelve null si el Embarque no existe (ej. documento sin Embarque asociado).
export async function resolverDatosEmbarqueExport(embarqueId: number): Promise<DatosEmbarqueExport | null> {
  const [embarque, lineasPeso] = await Promise.all([
    getEmbarqueParaDocumentoExport(embarqueId),
    getPesosEmbarque(embarqueId),
  ])
  if (!embarque) return null

  const nv = embarque.notaVenta

  // Transporte/booking: según `reservaManual`, de los campos *Manual del
  // Embarque o de la SolicitudReserva (AGL360) — mismo criterio que el DTE 110
  // y el Instructivo (factura-exportacion.service.ts).
  const nave = embarque.reservaManual ? embarque.naveManual : (embarque.solicitudReserva?.nave ?? null)
  const booking = embarque.reservaManual
    ? embarque.numeroBookingManual
    : (embarque.solicitudReserva?.numeroBooking ?? null)
  const contenedor = embarque.reservaManual
    ? embarque.numeroContenedorManual
    : (embarque.solicitudReserva?.numeroContenedor ?? null)
  const sello = embarque.numeroSelloManual ?? embarque.solicitudReserva?.numeroSello ?? null
  const etdDate = embarque.reservaManual ? embarque.fechaZarpeManual : (embarque.solicitudReserva?.fechaZarpe ?? null)

  // Pesos desde los pallets físicos (cada PalletLinea trae su embalaje con
  // kgNeto/BrutoEnvase) — mismo cálculo que el DTE 110.
  let pesoNetoAcum = 0
  let pesoBrutoAcum = 0
  for (const pl of lineasPeso) {
    if (pl.articulo?.kgNetoEnvase != null) pesoNetoAcum += pl.cajas * Number(pl.articulo.kgNetoEnvase)
    if (pl.articulo?.kgBrutoEnvase != null) pesoBrutoAcum += pl.cajas * Number(pl.articulo.kgBrutoEnvase)
  }

  return {
    nave,
    via: nv?.tipoEmbarque?.descripcion ?? null,
    blAwb: embarque.awbBl ?? null,
    tipoBl: nv?.tipoBl?.descripcion ?? null,
    booking,
    contenedor,
    sello,
    puertoEmbarque: embarque.puertoZarpe?.descripcion ?? null,
    puertoDestino: nv?.puertoDestino?.descripcion ?? null,
    etd: etdDate ? new Date(etdDate).toISOString() : null,
    eta: embarque.fechaArribo ? new Date(embarque.fechaArribo).toISOString() : null,
    flete: nv?.tipoFlete?.descripcion ?? null,
    modalidadVenta: nv?.modalidadVenta?.descripcion ?? null,
    incoterm: nv?.clausulaVenta?.descripcion ?? null,
    notify: mapEntidad(nv?.notify ?? null),
    consignatario: mapEntidad(nv?.consignatario ?? null),
    pesoNeto: pesoNetoAcum > 0 ? round2(pesoNetoAcum) : null,
    pesoBruto: pesoBrutoAcum > 0 ? round2(pesoBrutoAcum) : null,
  }
}
