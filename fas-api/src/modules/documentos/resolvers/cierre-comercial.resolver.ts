import { Prisma } from '@prisma/client'
import { NotFoundError } from '../../../shared/errors.js'
import { getNotaVentaById } from '../../ventas/notas-venta/notas-venta.repository.js'
import { firmaDataUri, getEmpresaParaDocumento, getEntidadParaDocumento, logoDataUri } from '../documentos.repository.js'
import { descripcionComercialArticulo } from '../../../shared/articulo-descripcion.js'
import { FECHA_REFERENCIA_LABEL } from './orden-compra.resolver.js'
import type { CierreComercialPdfPayload } from '../schemas/cierre-comercial.schema.js'

// Resolver del Cierre Comercial (modelo NotaVenta) — mismo criterio que
// orden-compra.resolver.ts, del que reusa FECHA_REFERENCIA_LABEL (mismo enum
// FechaReferenciaPago compartido entre OrdenCompraCuotaPago y NotaVentaCuotaPago).
//
// Feedback Christian (2026-08-19): Fecha Compromiso (por línea) y Dirección
// de destino (cabecera) no están en el documento original y no aportaban
// valor claro — se sacaron del payload (no solo de la plantilla).
export async function resolverCierreComercial(id: number, empresaId: number): Promise<CierreComercialPdfPayload> {
  const nv = await getNotaVentaById(id)
  if (!nv) throw new NotFoundError('Cierre Comercial', String(id))

  const [empresa, cliente, exportador, firmaResponsable] = await Promise.all([
    getEmpresaParaDocumento(empresaId),
    getEntidadParaDocumento(nv.clienteId),
    nv.exportadorId != null ? getEntidadParaDocumento(nv.exportadorId) : Promise.resolve(null),
    firmaDataUri(nv.responsableVentaId),
  ])

  const calculadas = nv.detalles.map((l) => ({
    l,
    kgNetoEnvase: l.articulo.kgNetoEnvase ? new Prisma.Decimal(l.articulo.kgNetoEnvase) : new Prisma.Decimal(0),
    total: new Prisma.Decimal(l.precio).mul(l.cajas),
  }))

  const lineas = calculadas.map(({ l, kgNetoEnvase, total }) => ({
    especie: l.especie.descripcion,
    variedad: l.variedad.descripcion,
    // Descripción comercial (de venta) del artículo, no la de materiales (2026-11-05).
    articulo: descripcionComercialArticulo(l.articulo),
    // Etiqueta (Marca) DE LA LÍNEA (2026-11-05, antes salía la del artículo);
    // la del artículo queda como respaldo para líneas antiguas sin etiqueta.
    etiqueta: l.etiqueta?.descripcion ?? l.articulo.etiqueta?.descripcion ?? null,
    calibres: textoCalibres(l.calibres.map((c) => c.calibre), l.calibreModo),
    categoria: l.categoria?.descripcion ?? null,
    tipoPallet: l.tipoPallet?.descripcion ?? null,
    cantidadPallets: l.cantidadPallets,
    cajasPorPallet: l.cajasPorPallet,
    cajas: l.cajas,
    precio: new Prisma.Decimal(l.precio).toString(),
    total: total.toString(),
    kgNetoEnvase: kgNetoEnvase.toString(),
  }))

  const totales = calculadas.reduce(
    (acc, c) => ({
      pallets: acc.pallets + c.l.cantidadPallets,
      cajas: acc.cajas + c.l.cajas,
      totalMonto: acc.totalMonto.add(c.total),
    }),
    { pallets: 0, cajas: 0, totalMonto: new Prisma.Decimal(0) },
  )

  return {
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
    calidadHasta: nv.notaCalidadHasta ? `${nv.notaCalidadHasta.codigo} — ${nv.notaCalidadHasta.descripcion}` : null,
    condicionHasta: nv.notaCondicionHasta ? `${nv.notaCondicionHasta.codigo} — ${nv.notaCondicionHasta.descripcion}` : null,
    folio: String(nv.folio),
    fecha: nv.fecha.toISOString(),
    cliente: {
      razonSocial: cliente?.razonSocial ?? nv.cliente.razonSocial,
      rut: cliente?.identificador ?? null,
      direccion: cliente?.direcciones[0]?.direccion ?? null,
      contacto: cliente?.contactos[0]?.nombre ?? null,
    },
    compradorContacto: nv.compradorContacto?.nombre ?? null,
    notify: nv.notify?.descripcion ?? null,
    consignatario: nv.consignatario?.descripcion ?? null,
    tipoEmbarque: nv.tipoEmbarque?.descripcion ?? null,
    mercado: nv.mercado?.descripcion ?? null,
    paisDestino: nv.paisDestino?.descripcion ?? null,
    puertoDestino: nv.puertoDestino?.descripcion ?? null,
    modalidadVenta: nv.modalidadVenta?.descripcion ?? null,
    clausulaVenta: nv.clausulaVenta?.descripcion ?? null,
    tipoFlete: nv.tipoFlete?.descripcion ?? null,
    condicionPago: nv.condicionPago?.descripcion ?? null,
    moneda: nv.moneda.codigo,
    observaciones: nv.observaciones,
    lineas,
    totales: {
      pallets: totales.pallets,
      cajas: totales.cajas,
      totalMonto: totales.totalMonto.toString(),
    },
  }
}

// Calibres en el PDF (2026-11-05): RANGO = "Desde {menor} hasta {mayor}" según
// el orden del mantenedor de calibres; ESPECIFICOS = lista. Con un solo calibre
// se muestra tal cual en ambos modos.
export function textoCalibres(
  calibres: { descripcion: string; orden: number }[],
  modo: 'ESPECIFICOS' | 'RANGO',
): string {
  const ordenados = [...calibres].sort((a, b) => a.orden - b.orden)
  if (modo === 'RANGO' && ordenados.length > 1) {
    return `Desde ${ordenados[0].descripcion} hasta ${ordenados[ordenados.length - 1].descripcion}`
  }
  return ordenados.map((c) => c.descripcion).join(', ')
}

// Reexport — el título "FECHA_REFERENCIA_LABEL" queda dueño de
// orden-compra.resolver.ts (primer documento en usarlo); la plantilla de
// Cierre Comercial lo importa desde acá para no acoplarse a ese archivo.
export { FECHA_REFERENCIA_LABEL }
