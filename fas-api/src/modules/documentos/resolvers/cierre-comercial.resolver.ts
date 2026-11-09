import { Prisma } from '@prisma/client'
import { NotFoundError } from '../../../shared/errors.js'
import { getNotaVentaById } from '../../ventas/notas-venta/notas-venta.repository.js'
import { firmaDataUri, getEmpresaParaDocumento, getEntidadParaDocumento, logoDataUri, getEspecieImagenDataUri, getReclamosCierre } from '../documentos.repository.js'
import type { ResolverOpciones } from '../documentos.types.js'
import { descripcionComercialArticulo } from '../../../shared/articulo-descripcion.js'
import { FECHA_REFERENCIA_LABEL, valorIdioma, lineasDireccion } from './orden-compra.resolver.js'
import type { CierreComercialPdfPayload } from '../schemas/cierre-comercial.schema.js'
import { textoCalibres } from './calibres-texto.js'

// Resolver del Cierre Comercial (modelo NotaVenta) — mismo criterio que
// orden-compra.resolver.ts, del que reusa FECHA_REFERENCIA_LABEL (mismo enum
// FechaReferenciaPago compartido entre OrdenCompraCuotaPago y NotaVentaCuotaPago).
//
// Feedback Christian (2026-08-19): Fecha Compromiso (por línea) y Dirección
// de destino (cabecera) no están en el documento original y no aportaban
// valor claro — se sacaron del payload (no solo de la plantilla).
export async function resolverCierreComercial(id: number, empresaId: number, opciones?: ResolverOpciones): Promise<CierreComercialPdfPayload> {
  const idioma = opciones?.idioma === 'EN' ? 'EN' : 'ES'
  const nv = await getNotaVentaById(id)
  if (!nv) throw new NotFoundError('Cierre Comercial', String(id))

  // Imagen de cabecera: especie de la primera línea (detalles ordenados por id).
  const primeraEspecieId = nv.detalles[0]?.especie.id ?? null
  const [empresa, cliente, exportador, firmaResponsable, especieImagenDataUri, reclamosEmpresa] = await Promise.all([
    getEmpresaParaDocumento(empresaId),
    getEntidadParaDocumento(nv.clienteId),
    nv.exportadorId != null ? getEntidadParaDocumento(nv.exportadorId) : Promise.resolve(null),
    firmaDataUri(nv.responsableVentaId),
    getEspecieImagenDataUri(primeraEspecieId),
    getReclamosCierre(empresaId),
  ])
  // Texto de catálogo en el idioma del documento (descripcionExtranjera en EN).
  const tx = (o: { descripcion: string; descripcionExtranjera?: string | null; descripcionComercial?: string | null } | null | undefined) => valorIdioma(o, idioma)

  const calculadas = nv.detalles.map((l) => ({
    l,
    kgNetoEnvase: l.articulo.kgNetoEnvase ? new Prisma.Decimal(l.articulo.kgNetoEnvase) : new Prisma.Decimal(0),
    kgBrutoEnvase: l.articulo.kgBrutoEnvase ? new Prisma.Decimal(l.articulo.kgBrutoEnvase) : new Prisma.Decimal(0),
    total: new Prisma.Decimal(l.precio).mul(l.cajas),
  }))

  const lineas = calculadas.map(({ l, kgNetoEnvase, kgBrutoEnvase, total }) => ({
    especie: tx(l.especie)!,
    variedad: tx(l.variedad)!,
    // Descripción comercial (de venta) del artículo, no la de materiales
    // (2026-11-05); en EN, su descripción extranjera.
    articulo: idioma === 'EN' ? (l.articulo.descripcionExtranjera?.trim() || descripcionComercialArticulo(l.articulo)) : descripcionComercialArticulo(l.articulo),
    // Etiqueta (Marca) DE LA LÍNEA (2026-11-05, antes salía la del artículo);
    // la del artículo queda como respaldo para líneas antiguas sin etiqueta.
    etiqueta: tx(l.etiqueta) ?? l.articulo.etiqueta?.descripcion ?? null,
    calibres: textoCalibres(l.calibres.map((c) => ({ descripcion: tx(c.calibre)!, orden: c.calibre.orden })), l.calibreModo, idioma),
    categoria: tx(l.categoria),
    tipoPallet: tx(l.tipoPallet),
    cantidadPallets: l.cantidadPallets,
    cajasPorPallet: l.cajasPorPallet,
    cajas: l.cajas,
    precio: new Prisma.Decimal(l.precio).toString(),
    total: total.toString(),
    kgNetoEnvase: kgNetoEnvase.toString(),
    kgBrutoEnvase: kgBrutoEnvase.toString(),
    // Calidad / Condición "hasta" de la línea (2026-11-09): solo el código
    // (columna compacta de la tabla v4).
    calidadHasta: l.notaCalidadHasta?.codigo ?? null,
    condicionHasta: l.notaCondicionHasta?.codigo ?? null,
  }))

  // Plantillas v1–v3 (encabezado): valor común a todas las líneas, o null si
  // difieren / no hay restricción.
  const hastaComun = (notas: ({ codigo: string; descripcion: string; descripcionExtranjera?: string | null } | null)[]) => {
    const primera = notas[0]
    if (!primera || notas.some((x) => x?.codigo !== primera.codigo)) return null
    return `${primera.codigo} — ${tx(primera)}`
  }

  const totales = calculadas.reduce(
    (acc, c) => ({
      pallets: acc.pallets + c.l.cantidadPallets,
      cajas: acc.cajas + c.l.cajas,
      totalMonto: acc.totalMonto.add(c.total),
      kgNeto: acc.kgNeto.add(c.kgNetoEnvase.mul(c.l.cajas)),
      kgBruto: acc.kgBruto.add(c.kgBrutoEnvase.mul(c.l.cajas)),
    }),
    { pallets: 0, cajas: 0, totalMonto: new Prisma.Decimal(0), kgNeto: new Prisma.Decimal(0), kgBruto: new Prisma.Decimal(0) },
  )

  // v2: Vendedor = exportador del Cierre (o la empresa); contacto = responsable de venta.
  const vendedorDireccion = exportador ? exportador.direcciones[0] : empresa?.direcciones[0]
  // Comprador: la dirección elegida en el Cierre o la por defecto del cliente.
  // El Detalle de Dirección dejó de usarse (2026-11-09).
  const direccionComprador = nv.direccion ?? cliente?.direcciones[0]
  const lineasComprador = lineasDireccion(direccionComprador as Parameters<typeof lineasDireccion>[0], idioma)
  const tiposPallet = [...new Set(lineas.map((l) => l.tipoPallet).filter((t): t is string => !!t))]
  const reclamosTexto = idioma === 'EN' ? reclamosEmpresa?.reclamosCierreEn : reclamosEmpresa?.reclamosCierreEs
  const reclamosRef = idioma === 'EN' ? reclamosEmpresa?.reclamosCierreRefEn : reclamosEmpresa?.reclamosCierreRefEs

  return {
    idioma,
    especieImagenDataUri,
    tipoVenta: nv.tipoVenta,
    vendedor: {
      razonSocial: exportador?.razonSocial ?? empresa?.razonSocial ?? '—',
      rut: (exportador ? exportador.identificador : empresa?.rut) ?? null,
      direccionLineas: lineasDireccion(vendedorDireccion as Parameters<typeof lineasDireccion>[0], idioma),
      contacto: {
        nombre: nv.responsableVenta?.nombre ?? null,
        email: nv.responsableVenta?.email ?? null,
        telefono: nv.responsableVenta?.whatsapp?.trim() || null,
      },
    },
    comprador: {
      razonSocial: cliente?.razonSocial ?? nv.cliente.razonSocial,
      codigo: nv.cliente.codigo ?? null,
      direccionLineas: lineasComprador,
      contacto: {
        nombre: nv.compradorContacto?.nombre ?? null,
        email: nv.compradorContacto?.email?.trim() || null,
        telefono: nv.compradorContacto?.telefono?.trim() || nv.compradorContacto?.whatsapp?.trim() || null,
      },
    },
    formaPago: tx(nv.formaPago),
    seguroIncluido: nv.clausulaVenta ? nv.clausulaVenta.requiereSeguro : null,
    embalaje: tiposPallet.length ? tiposPallet.join(', ') : null,
    reclamos: reclamosTexto?.trim() ? { texto: reclamosTexto.trim(), referencia: reclamosRef?.trim() || null } : null,
    empresa: {
      razonSocial: empresa?.razonSocial ?? '—',
      rut: empresa?.rut ?? null,
      direccion: empresa?.direcciones[0]?.direccion ?? null,
      logoDataUri: logoDataUri(empresa?.logo),
    },
    // Exportador del Cierre (2026-11-05, antes siempre la empresa).
    exportador: exportador
      ? {
          razonSocial: exportador.razonSocial,
          rut: exportador.identificador ?? null,
          direccion: exportador.direcciones[0]?.direccion ?? null,
        }
      : {
          razonSocial: empresa?.razonSocial ?? '—',
          rut: empresa?.rut ?? null,
          direccion: empresa?.direcciones[0]?.direccion ?? null,
        },
    responsableVenta: nv.responsableVenta?.nombre ?? null,
    firmaResponsableDataUri: firmaResponsable,
    calidadHasta: hastaComun(nv.detalles.map((l) => l.notaCalidadHasta)),
    condicionHasta: hastaComun(nv.detalles.map((l) => l.notaCondicionHasta)),
    folio: String(nv.folio),
    fecha: nv.fecha.toISOString(),
    cliente: {
      razonSocial: cliente?.razonSocial ?? nv.cliente.razonSocial,
      rut: cliente?.identificador ?? null,
      direccion: cliente?.direcciones[0]?.direccion ?? null,
      contacto: cliente?.contactos[0]?.nombre ?? null,
    },
    compradorContacto: nv.compradorContacto?.nombre ?? null,
    notify: nv.notify ? (nv.notify.razonSocial || nv.notify.descripcion) : null,
    consignatario: nv.consignatario ? (nv.consignatario.razonSocial || nv.consignatario.descripcion) : null,
    tipoEmbarque: tx(nv.tipoEmbarque),
    mercado: tx(nv.mercado),
    paisDestino: tx(nv.paisDestino),
    puertoDestino: tx(nv.puertoDestino),
    modalidadVenta: tx(nv.modalidadVenta),
    clausulaVenta: tx(nv.clausulaVenta),
    tipoFlete: tx(nv.tipoFlete),
    condicionPago: nv.condicionPago?.descripcion ?? null,
    moneda: nv.moneda.codigo,
    observaciones: nv.observaciones,
    lineas,
    totales: {
      pallets: totales.pallets,
      cajas: totales.cajas,
      totalMonto: totales.totalMonto.toString(),
      kgNeto: totales.kgNeto.toString(),
      kgBruto: totales.kgBruto.toString(),
    },
  }
}

// textoCalibres vive en ./calibres-texto.ts (compartido con la OC, 2026-11-09).
export { textoCalibres } from './calibres-texto.js'

// Reexport — el título "FECHA_REFERENCIA_LABEL" queda dueño de
// orden-compra.resolver.ts (primer documento en usarlo); la plantilla de
// Cierre Comercial lo importa desde acá para no acoplarse a ese archivo.
export { FECHA_REFERENCIA_LABEL }
