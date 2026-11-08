import { Prisma } from '@prisma/client'
import { NotFoundError } from '../../../shared/errors.js'
import { getOrdenCompraById } from '../../compras/ordenes-compra/ordenes-compra.repository.js'
import { getEmpresaParaDocumento, getEntidadParaDocumento, logoDataUri, getEspecieImagenDataUri, firmaDataUri, getTerminosOc } from '../documentos.repository.js'
import type { ResolverOpciones } from '../documentos.types.js'
import type { OrdenCompraPdfPayload } from '../schemas/orden-compra.schema.js'
import { descripcionComercialArticulo } from '../../../shared/articulo-descripcion.js'

export const FECHA_REFERENCIA_LABEL: Record<string, string> = {
  FACTURA: 'Factura',
  ZARPE: 'Zarpe',
  ENVIO_DOCUMENTOS: 'Envío de documentos',
  ARRIBO: 'Arribo',
}

// Valor de un mantenedor en el idioma del documento: descripcionExtranjera en
// EN (si existe), descripcion en ES o cuando no hay traducción.
// Artículo (2026-11-05): en ES usa su descripción comercial (fallback a
// descripcion) — el helper es inocuo para los demás mantenedores.
type Traducible = { descripcion: string; descripcionExtranjera?: string | null; descripcionComercial?: string | null }
export function valorIdioma(o: Traducible | null | undefined, idioma: 'ES' | 'EN'): string | null {
  if (!o) return null
  const base = descripcionComercialArticulo(o)
  return idioma === 'EN' ? (o.descripcionExtranjera?.trim() || base) : base
}

// Resolver de Orden de Compra — Etapa 4 §4: "consulta la base y arma un
// payload tipado con Zod. Nada de lógica de presentación." Reusa
// ordenes-compra.repository.ts (repository pattern, CLAUDE.md §12.2) en vez
// de duplicar la query; getEmpresaParaDocumento/getEntidadParaDocumento
// (documentos.repository.ts) cubren solo lo que el PDF necesita y el
// endpoint normal de OC no expone (RUT, dirección por defecto).
// Dirección completa en líneas (v3, 2026-11-06): calle · "comuna, región" · país
// (país en el idioma del documento). Sin datos → arreglo vacío.
export interface DireccionDoc {
  direccion: string
  comuna: { descripcion: string; provincia: { region: { descripcion: string } } } | null
  pais: { descripcion: string; descripcionExtranjera: string | null } | null
}
export function lineasDireccion(d: DireccionDoc | undefined, idioma: 'ES' | 'EN'): string[] {
  if (!d) return []
  const zona = [d.comuna?.descripcion, d.comuna?.provincia.region.descripcion].filter(Boolean).join(', ')
  const pais = d.pais ? (idioma === 'EN' ? d.pais.descripcionExtranjera?.trim() || d.pais.descripcion : d.pais.descripcion) : ''
  return [d.direccion, zona, pais].map((x) => x?.trim() ?? '').filter(Boolean)
}

export async function resolverOrdenCompra(id: number, empresaId: number, opciones: ResolverOpciones): Promise<OrdenCompraPdfPayload> {
  const oc = await getOrdenCompraById(id)
  if (!oc) throw new NotFoundError('Orden de Compra', String(id))

  const idioma = opciones.idioma
  // Imagen de la "primera especie por ID" entre las líneas (menor id del
  // maestro) para el banner del encabezado.
  const especieIds = oc.lineas.map((l) => l.especie.id)
  const primeraEspecieId = especieIds.length ? Math.min(...especieIds) : null

  const [empresa, productor, especieImagenDataUri, firmaComprador, terminosOc] = await Promise.all([
    getEmpresaParaDocumento(empresaId),
    getEntidadParaDocumento(oc.entidadProductorId),
    getEspecieImagenDataUri(primeraEspecieId),
    firmaDataUri(oc.responsable?.id),
    getTerminosOc(empresaId),
  ])
  // Términos en el idioma del documento; {empresa} = razón social de la empresa.
  const razonSocialEmpresa = empresa?.razonSocial ?? ''
  const conEmpresa = (t: string) => t.replaceAll('{empresa}', razonSocialEmpresa)
  const terminos = terminosOc.clausulas.length > 0
    ? {
        clausulas: terminosOc.clausulas.map((c) => ({
          icono: c.icono,
          titulo: conEmpresa(idioma === 'EN' ? c.tituloEn : c.tituloEs),
          texto: conEmpresa(idioma === 'EN' ? c.textoEn : c.textoEs),
        })),
        nota: (() => {
          const n = idioma === 'EN' ? terminosOc.notaEn : terminosOc.notaEs
          return n ? conEmpresa(n) : null
        })(),
      }
    : null

  // Cálculo en Decimal (CLAUDE.md §12.5) — nunca number de JS. El detalle
  // depende de la modalidad (2026-10-23):
  // - CAJAS: Total = precio/caja × cajas; Kg Neto/Bruto = cajas × kg del envase
  //   (Articulo.kgNetoEnvase/kgBrutoEnvase), mismo cálculo que el ejemplo real
  //   (Docs/AGROSAN 002 -OC5.pdf: 240 cajas × 2,50 kg = 600 kg neto).
  // - GRANEL: Total = precio/kilo × kilos; no hay cajas/pallets/categoría/
  //   calibre/etiqueta ni kg de envase (se compra al peso).
  const esGranel = oc.modalidad === 'GRANEL'

  const lineas = oc.lineas.map((l) => {
    const base = {
      especie: valorIdioma(l.especie, idioma)!,
      variedad: valorIdioma(l.variedad, idioma)!,
      articulo: valorIdioma(l.articulo, idioma)!,
      // Descripción, no código (feedback Christian, 2026-08-19) — en las 3
      // plantillas del motor, no solo acá.
      etiqueta: valorIdioma(l.articulo.etiqueta, idioma),
    }
    if (esGranel) {
      const kilos = new Prisma.Decimal(l.cantidadKilos ?? 0)
      const precioKilo = new Prisma.Decimal(l.precioUsdKilo ?? 0)
      return {
        ...base,
        calibres: '',
        categoria: null,
        cantidadPallets: null,
        cajas: null,
        precioUsdCaja: null,
        cantidadKilos: kilos.toString(),
        precioUsdKilo: precioKilo.toString(),
        totalUsd: precioKilo.mul(kilos).toString(),
        kgNetoEnvase: null,
        kgBrutoEnvase: null,
        kgNeto: null,
        kgBruto: null,
      }
    }
    const kgNetoEnvase = l.articulo.kgNetoEnvase ? new Prisma.Decimal(l.articulo.kgNetoEnvase) : new Prisma.Decimal(0)
    const kgBrutoEnvase = l.articulo.kgBrutoEnvase ? new Prisma.Decimal(l.articulo.kgBrutoEnvase) : new Prisma.Decimal(0)
    const cajas = l.cajas ?? 0
    const precioCaja = new Prisma.Decimal(l.precioUsdCaja ?? 0)
    return {
      ...base,
      calibres: l.calibres.map((c) => valorIdioma(c.calibre, idioma)).join(', '),
      categoria: valorIdioma(l.categoria, idioma),
      cantidadPallets: l.cantidadPallets,
      cajas: l.cajas,
      precioUsdCaja: precioCaja.toString(),
      cantidadKilos: null,
      precioUsdKilo: null,
      totalUsd: precioCaja.mul(cajas).toString(),
      // Kg Neto/Bruto Envase: dato de catálogo; Kg Neto/Bruto: total de la
      // línea (envase × cajas) — se muestran ambos (feedback Christian 2026-08-19).
      kgNetoEnvase: kgNetoEnvase.toString(),
      kgBrutoEnvase: kgBrutoEnvase.toString(),
      kgNeto: kgNetoEnvase.mul(cajas).toString(),
      kgBruto: kgBrutoEnvase.mul(cajas).toString(),
    }
  })

  const totales = oc.lineas.reduce(
    (acc, l) => {
      if (esGranel) {
        const kilos = new Prisma.Decimal(l.cantidadKilos ?? 0)
        return {
          ...acc,
          kilos: acc.kilos.add(kilos),
          totalUsd: acc.totalUsd.add(new Prisma.Decimal(l.precioUsdKilo ?? 0).mul(kilos)),
        }
      }
      const cajas = l.cajas ?? 0
      const kgNetoEnvase = l.articulo.kgNetoEnvase ? new Prisma.Decimal(l.articulo.kgNetoEnvase) : new Prisma.Decimal(0)
      const kgBrutoEnvase = l.articulo.kgBrutoEnvase ? new Prisma.Decimal(l.articulo.kgBrutoEnvase) : new Prisma.Decimal(0)
      return {
        pallets: acc.pallets + (l.cantidadPallets ?? 0),
        cajas: acc.cajas + cajas,
        kilos: acc.kilos,
        totalUsd: acc.totalUsd.add(new Prisma.Decimal(l.precioUsdCaja ?? 0).mul(cajas)),
        kgNeto: acc.kgNeto.add(kgNetoEnvase.mul(cajas)),
        kgBruto: acc.kgBruto.add(kgBrutoEnvase.mul(cajas)),
      }
    },
    { pallets: 0, cajas: 0, kilos: new Prisma.Decimal(0), totalUsd: new Prisma.Decimal(0), kgNeto: new Prisma.Decimal(0), kgBruto: new Prisma.Decimal(0) },
  )

  return {
    idioma,
    especieImagenDataUri,
    empresa: {
      codigo: empresa?.codigo ?? '',
      razonSocial: empresa?.razonSocial ?? '—',
      rut: empresa?.rut ?? null,
      direccion: empresa?.direcciones[0]?.direccion ?? null,
      logoDataUri: logoDataUri(empresa?.logo),
      direccionLineas: lineasDireccion(empresa?.direcciones[0], idioma),
    },
    comprador: {
      nombre: oc.responsable?.nombre ?? null,
      telefono: oc.responsable?.whatsapp?.trim() || null,
      email: oc.responsable?.email ?? null,
    },
    firmaCompradorDataUri: firmaComprador,
    terminos,
    numero: oc.numero,
    modalidad: oc.modalidad,
    fecha: oc.fecha.toISOString(),
    responsable: oc.responsable?.nombre ?? null,
    productor: {
      razonSocial: productor?.razonSocial ?? oc.entidadProductor.razonSocial,
      rut: productor?.identificador ?? null,
      direccion: productor?.direcciones[0]?.direccion ?? null,
      contacto: productor?.contactos[0]?.nombre ?? null,
      direccionLineas: lineasDireccion(productor?.direcciones[0], idioma),
      contactoTelefono: productor?.contactos[0]?.telefono?.trim() || productor?.telefono?.trim() || null,
      contactoEmail: productor?.contactos[0]?.email?.trim() || null,
    },
    formaPago: valorIdioma(oc.formaPago, idioma),
    moneda: oc.moneda.codigo,
    incoterm: valorIdioma(oc.incoterm, idioma),
    destinoMercado: valorIdioma(oc.destinoMercado, idioma),
    porcentajeMinExportacion: oc.porcentajeMinExportacion != null ? oc.porcentajeMinExportacion.toString() : null,
    modalidadEntregaGranel: oc.modalidadEntregaGranel,
    envasesProporcionadosPor: oc.envasesProporcionadosPor,
    encargadoDescartePor: oc.encargadoDescartePor,
    cuotas: oc.cuotasPago.map((c) => ({
      plazoDias: c.plazoDias,
      fechaReferencia: c.fechaReferencia,
      tipoValor: c.tipoValor,
      porcentaje: c.porcentaje ? c.porcentaje.toString() : null,
      valorUnitario: c.valorUnitario ? c.valorUnitario.toString() : null,
      unidad: valorIdioma(c.unidad, idioma),
    })),
    observaciones: oc.observaciones,
    lineas,
    totales: {
      pallets: totales.pallets,
      cajas: totales.cajas,
      kilos: totales.kilos.toString(),
      totalUsd: totales.totalUsd.toString(),
      kgNeto: totales.kgNeto.toString(),
      kgBruto: totales.kgBruto.toString(),
    },
  }
}
