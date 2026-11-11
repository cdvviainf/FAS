import { NotFoundError } from '../../../shared/errors.js'
import { getInstructivoHijoConDetalle } from '../../ventas/embarques/embarques.repository.js'
import { getEmpresaParaDocumento, getEntidadParaDocumento, getNotifiesCliente, logoDataUri, getEspecieImagenDataUri } from '../documentos.repository.js'
import type { InstructivoEmbarquePdfPayload } from '../schemas/instructivo-embarque.schema.js'
import { descripcionComercialArticulo } from '../../../shared/articulo-descripcion.js'
import { lineasDireccion } from './orden-compra.resolver.js'
import type { ResolverOpciones } from '../documentos.types.js'

type EntidadDocumento = Awaited<ReturnType<typeof getEntidadParaDocumento>>
type Idioma = 'ES' | 'EN'

// Contacto "Documental" (v4, 2026-11-11): EntidadContacto.tipo es texto libre;
// se acepta "Documental", "Documentación", "Documentos"… sin tildes ni mayúsculas.
function esDocumental(tipo: string | null | undefined): boolean {
  if (!tipo) return false
  return tipo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('document')
}

// Mapea una Entidad (Notify/Consignatario) a los datos completos que la AGA
// necesita en el Instructivo: dirección, RUT, TaxId, teléfono y contacto.
function actorCompleto(ent: EntidadDocumento, idioma: Idioma = 'ES') {
  if (!ent) return null
  return {
    razonSocial: ent.razonSocial,
    direccion: ent.direcciones[0]?.direccion ?? null,
    rut: ent.identificador ?? null,
    taxId: ent.taxId ?? null,
    telefono: ent.telefono ?? null,
    contacto: ent.contactos[0]?.nombre ?? null,
    contactoTelefono: ent.contactos[0]?.telefono ?? null,
    esNacional: ent.pais?.esPaisNacional ?? false,
    direccionLineas: lineasDireccion(ent.direcciones[0], idioma),
    contactosDocumentales: ent.contactos
      .filter((c) => esDocumental(c.tipo))
      .map((c) => ({ nombre: c.nombre, telefono: c.telefono ?? null, email: c.email ?? null })),
  }
}

// Resolver del Instructivo de Embarque (InstructivoHijo, ventas.md R11) —
// mismo criterio que instructivo-embalaje.resolver.ts. `id` acá es el id del
// InstructivoHijo, no del Embarque — cada Planta/punto de retiro tiene su
// propio documento.
export async function resolverInstructivoEmbarque(id: number, empresaId: number, opciones?: ResolverOpciones): Promise<InstructivoEmbarquePdfPayload> {
  const idioma: Idioma = opciones?.idioma ?? 'ES'
  const detalle = await getInstructivoHijoConDetalle(id)
  if (!detalle) throw new NotFoundError('Instructivo de Embarque', String(id))
  const { instructivo, pallets } = detalle
  const embarque = instructivo.embarque
  const nv = embarque.notaVenta

  const esVentaNacional = nv.tipoVenta === 'NACIONAL'
  const [empresa, planta, cliente, consignatario, notify, agenteAduana, embarcador, naviera, notifiesCliente, exportadora] = await Promise.all([
    getEmpresaParaDocumento(empresaId),
    getEntidadParaDocumento(instructivo.plantaId),
    getEntidadParaDocumento(nv.clienteId),
    nv.consignatarioId ? getEntidadParaDocumento(nv.consignatarioId) : Promise.resolve(null),
    nv.notifyId ? getEntidadParaDocumento(nv.notifyId) : Promise.resolve(null),
    embarque.agenteAduanaId ? getEntidadParaDocumento(embarque.agenteAduanaId) : Promise.resolve(null),
    embarque.embarcadorId ? getEntidadParaDocumento(embarque.embarcadorId) : Promise.resolve(null),
    embarque.navieraId ? getEntidadParaDocumento(embarque.navieraId) : Promise.resolve(null),
    getNotifiesCliente(nv.clienteId),
    // Exportador (v4): en exportación la Entidad EXPORTADORA de la NV; en venta
    // NACIONAL exporta el cliente (2026-10-17).
    !esVentaNacional && nv.exportadorId ? getEntidadParaDocumento(nv.exportadorId) : Promise.resolve(null),
  ])

  const lineas = pallets.flatMap((p) =>
    p.lineas.map((l) => {
      const kgNeto = l.articulo.kgNetoEnvase != null ? Number(l.articulo.kgNetoEnvase) : 0
      const kgBruto = l.articulo.kgBrutoEnvase != null ? Number(l.articulo.kgBrutoEnvase) : 0
      return {
        numeroPallet: p.numeroPallet,
        especie: l.especie.descripcion,
        variedad: l.variedad.descripcion,
        categoria: l.categoria.descripcion,
        calibre: l.calibre.descripcion,
        articulo: descripcionComercialArticulo(l.articulo),
        productor: p.productor.razonSocial,
        cajas: l.cajas,
        pesoNeto: l.cajas * kgNeto,
        pesoBruto: l.cajas * kgBruto,
      }
    }),
  )

  // Imagen de la especie (primera línea) para la cabecera corporativa (2026-11-08).
  const especieImagenDataUri = await getEspecieImagenDataUri(pallets[0]?.lineas[0]?.especie.id ?? null)

  // Exportador (v4): entidad exportadora; sin una asignada en exportación,
  // la empresa emisora (sin contactos documentales: no es una Entidad).
  const exportadorEntidad = esVentaNacional
    ? actorCompleto(cliente, idioma)
    : (actorCompleto(exportadora, idioma) ?? {
        razonSocial: empresa?.razonSocial ?? '—',
        direccion: empresa?.direcciones[0]?.direccion ?? null,
        rut: empresa?.rut ?? null,
        taxId: null,
        telefono: empresa?.telefono ?? null,
        contacto: null,
        contactoTelefono: null,
        esNacional: true,
        direccionLineas: lineasDireccion(empresa?.direcciones[0], idioma),
        contactosDocumentales: [],
      })

  return {
    idioma,
    esVentaNacional,
    exportadorEntidad,
    especieImagenDataUri,
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
      direccionLineas: lineasDireccion(planta?.direcciones[0], idioma),
      csp: planta?.csp ?? null,
    },
    cliente: {
      razonSocial: cliente?.razonSocial ?? '—',
      rut: cliente?.identificador ?? null,
      taxId: cliente?.taxId ?? null,
      direccion: cliente?.direcciones[0]?.direccion ?? null,
      esNacional: cliente?.pais?.esPaisNacional ?? false,
    },
    clienteCompleto: actorCompleto(cliente, idioma),
    // Venta NACIONAL (2026-10-17): el exportador es el cliente (exportadora),
    // no la empresa. En exportación queda null (exporta la empresa emisora).
    exportador:
      nv.tipoVenta === 'NACIONAL'
        ? { razonSocial: cliente?.razonSocial ?? '—', rut: cliente?.identificador ?? null }
        : null,
    // Notify y Consignatario (AGA): sólo se emiten con sus datos completos
    // cuando difieren del Cliente (2026-10-12). Si coinciden con el Cliente (o
    // no hay uno asignado) el bloque queda null y no se repite en el PDF.
    consignatario: nv.consignatarioId != null && nv.consignatarioId !== nv.clienteId ? actorCompleto(consignatario, idioma) : null,
    notify: nv.notifyId != null && nv.notifyId !== nv.clienteId ? actorCompleto(notify, idioma) : null,
    // v3 (2026-11-10): todos los Notify asociados al Cliente en su ficha.
    clienteEsNotify: notifiesCliente.clienteEsNotify,
    notifies: notifiesCliente.notifies.map((n) => actorCompleto(n, idioma)!).filter(Boolean),
    tipoEmbarque: nv.tipoEmbarque?.descripcion ?? null,
    tipoFlete: nv.tipoFlete?.descripcion ?? null,
    modalidadVenta: nv.modalidadVenta?.descripcion ?? null,
    incoterm: nv.clausulaVenta?.descripcion ?? null,
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
    fechaArribo: embarque.fechaArribo ? embarque.fechaArribo.toISOString() : null,
    fechaCargaPlanta: instructivo.fechaCargaPlanta ? instructivo.fechaCargaPlanta.toISOString() : null,
    stackingRangos: embarque.stackingRangos.map((r) => ({ desde: r.desde.toISOString(), hasta: r.hasta.toISOString() })),
    observacionesGenerales: embarque.observacionesInstructivo,
    observaciones: instructivo.observaciones,
    lineas,
    totales: {
      pallets: pallets.length,
      folios: new Set(pallets.map((p) => p.numeroPallet)).size,
      cajas: lineas.reduce((acc, l) => acc + l.cajas, 0),
      pesoNeto: lineas.reduce((acc, l) => acc + l.pesoNeto, 0),
      pesoBruto: lineas.reduce((acc, l) => acc + l.pesoBruto, 0),
    },
  }
}
