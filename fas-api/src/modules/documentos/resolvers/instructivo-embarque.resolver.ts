import { NotFoundError } from '../../../shared/errors.js'
import { getInstructivoHijoConDetalle } from '../../ventas/embarques/embarques.repository.js'
import { getEmpresaParaDocumento, getEntidadParaDocumento, logoDataUri } from '../documentos.repository.js'
import type { InstructivoEmbarquePdfPayload } from '../schemas/instructivo-embarque.schema.js'

// Resolver del Instructivo de Embarque (InstructivoHijo, ventas.md R11) —
// mismo criterio que instructivo-embalaje.resolver.ts. `id` acá es el id del
// InstructivoHijo, no del Embarque — cada Planta/punto de retiro tiene su
// propio documento.
export async function resolverInstructivoEmbarque(id: number, empresaId: number): Promise<InstructivoEmbarquePdfPayload> {
  const detalle = await getInstructivoHijoConDetalle(id)
  if (!detalle) throw new NotFoundError('Instructivo de Embarque', String(id))
  const { instructivo, pallets } = detalle
  const embarque = instructivo.embarque
  const nv = embarque.notaVenta

  const [empresa, planta, cliente, consignatario, notify, agenteAduana, embarcador, naviera] = await Promise.all([
    getEmpresaParaDocumento(empresaId),
    getEntidadParaDocumento(instructivo.plantaId),
    getEntidadParaDocumento(nv.clienteId),
    nv.consignatarioId ? getEntidadParaDocumento(nv.consignatarioId) : Promise.resolve(null),
    nv.notifyId ? getEntidadParaDocumento(nv.notifyId) : Promise.resolve(null),
    embarque.agenteAduanaId ? getEntidadParaDocumento(embarque.agenteAduanaId) : Promise.resolve(null),
    embarque.embarcadorId ? getEntidadParaDocumento(embarque.embarcadorId) : Promise.resolve(null),
    embarque.navieraId ? getEntidadParaDocumento(embarque.navieraId) : Promise.resolve(null),
  ])

  const lineas = pallets.flatMap((p) =>
    p.lineas.map((l) => ({
      numeroPallet: p.numeroPallet,
      especie: l.especie.descripcion,
      variedad: l.variedad.descripcion,
      categoria: l.categoria.descripcion,
      calibre: l.calibre.descripcion,
      articulo: l.articulo.descripcion,
      productor: p.productor.razonSocial,
      cajas: l.cajas,
    })),
  )

  return {
    empresa: {
      razonSocial: empresa?.razonSocial ?? '—',
      rut: empresa?.rut ?? null,
      direccion: empresa?.direcciones[0]?.direccion ?? null,
      logoDataUri: logoDataUri(empresa?.logo),
    },
    codigo: instructivo.codigo,
    numeroInstructivoPadre: embarque.numeroInstructivo,
    fecha: instructivo.creadoEn.toISOString(),
    planta: {
      razonSocial: planta?.razonSocial ?? '—',
      direccion: planta?.direcciones[0]?.direccion ?? null,
    },
    cliente: {
      razonSocial: cliente?.razonSocial ?? '—',
      rut: cliente?.identificador ?? null,
      direccion: cliente?.direcciones[0]?.direccion ?? null,
    },
    consignatario: consignatario?.razonSocial ?? null,
    notify: notify?.razonSocial ?? null,
    tipoEmbarque: nv.tipoEmbarque?.descripcion ?? null,
    mercado: nv.mercado?.descripcion ?? null,
    paisDestino: nv.paisDestino?.descripcion ?? null,
    puertoDestino: nv.puertoDestino?.descripcion ?? null,
    puertoZarpe: embarque.puertoZarpe?.descripcion ?? null,
    voyageNumber: embarque.voyageNumber,
    deposito: embarque.deposito,
    awbBl: embarque.awbBl,
    cutoffDate: embarque.cutoffDate ? embarque.cutoffDate.toISOString() : null,
    tipoBultos: embarque.tipoBultos,
    agenteAduana: agenteAduana?.razonSocial ?? null,
    embarcador: embarcador?.razonSocial ?? null,
    naviera: naviera?.razonSocial ?? null,
    // FAS-IE-QA-006 (QA ronda 5): el booking efectivo depende del modo de
    // reserva — manual lo tipea el usuario en Embarque.*Manual; automático
    // lo guarda AGL360 en SolicitudReserva (ventas.md §4.3). navieraId queda
    // fuera de esta distinción: es un campo compartido del Instructivo,
    // unificado desde el navieraManual de texto libre que existía antes.
    numeroBooking: embarque.reservaManual ? embarque.numeroBookingManual : (embarque.solicitudReserva?.numeroBooking ?? null),
    nave: embarque.reservaManual ? embarque.naveManual : (embarque.solicitudReserva?.nave ?? null),
    numeroContenedor: embarque.reservaManual ? embarque.numeroContenedorManual : (embarque.solicitudReserva?.numeroContenedor ?? null),
    fechaZarpe: (() => {
      const fecha = embarque.reservaManual ? embarque.fechaZarpeManual : embarque.solicitudReserva?.fechaZarpe
      return fecha ? fecha.toISOString() : null
    })(),
    fechaCargaPlanta: instructivo.fechaCargaPlanta ? instructivo.fechaCargaPlanta.toISOString() : null,
    stackingDesde: instructivo.stackingDesde ? instructivo.stackingDesde.toISOString() : null,
    stackingHasta: instructivo.stackingHasta ? instructivo.stackingHasta.toISOString() : null,
    observaciones: instructivo.observaciones,
    lineas,
    totales: {
      pallets: pallets.length,
      cajas: lineas.reduce((acc, l) => acc + l.cajas, 0),
    },
  }
}
