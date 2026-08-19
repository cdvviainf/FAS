import { Prisma } from '@prisma/client'
import { NotFoundError } from '../../../shared/errors.js'
import { getNotaVentaById } from '../../ventas/notas-venta/notas-venta.repository.js'
import { getEmpresaParaDocumento, getEntidadParaDocumento, logoDataUri } from '../documentos.repository.js'
import { FECHA_REFERENCIA_LABEL } from './orden-compra.resolver.js'
import type { CierreComercialPdfPayload } from '../schemas/cierre-comercial.schema.js'

// Resolver del Cierre Comercial (modelo NotaVenta) — mismo criterio que
// orden-compra.resolver.ts, del que reusa FECHA_REFERENCIA_LABEL (mismo enum
// FechaReferenciaPago compartido entre OrdenCompraCuotaPago y NotaVentaCuotaPago).
export async function resolverCierreComercial(id: number, empresaId: number): Promise<CierreComercialPdfPayload> {
  const nv = await getNotaVentaById(id)
  if (!nv) throw new NotFoundError('Cierre Comercial', String(id))

  const [empresa, cliente] = await Promise.all([
    getEmpresaParaDocumento(empresaId),
    getEntidadParaDocumento(nv.clienteId),
  ])

  const calculadas = nv.detalles.map((l) => ({ l, total: new Prisma.Decimal(l.precio).mul(l.cajas) }))

  const lineas = calculadas.map(({ l, total }) => ({
    especie: l.especie.descripcion,
    variedad: l.variedad.descripcion,
    articulo: l.articulo.descripcion,
    etiqueta: l.articulo.etiqueta?.descripcion ?? null,
    calibres: l.calibres.map((c) => c.calibre.codigo).join(', '),
    categoria: l.categoria?.descripcion ?? null,
    tipoPallet: l.tipoPallet?.descripcion ?? null,
    cantidadPallets: l.cantidadPallets,
    cajasPorPallet: l.cajasPorPallet,
    cajas: l.cajas,
    precio: new Prisma.Decimal(l.precio).toString(),
    total: total.toString(),
    fechaCompromiso: l.fechaCompromiso.toISOString(),
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
    direccion: nv.direccion?.direccion ?? null,
    direccionDetalle: nv.direccionDetalle,
    modalidadVenta: nv.modalidadVenta?.descripcion ?? null,
    clausulaVenta: nv.clausulaVenta?.descripcion ?? null,
    tipoFlete: nv.tipoFlete?.descripcion ?? null,
    condicionPago: nv.condicionPago?.descripcion ?? null,
    moneda: nv.moneda.codigo,
    cuotas: nv.cuotasPago.map((c) => ({
      plazoDias: c.plazoDias,
      fechaReferencia: c.fechaReferencia,
      tipoValor: c.tipoValor,
      porcentaje: c.porcentaje ? c.porcentaje.toString() : null,
      valorUnitario: c.valorUnitario ? c.valorUnitario.toString() : null,
      unidad: c.unidad?.descripcion ?? null,
    })),
    observaciones: nv.observaciones,
    lineas,
    totales: {
      pallets: totales.pallets,
      cajas: totales.cajas,
      totalMonto: totales.totalMonto.toString(),
    },
  }
}

// Reexport — el título "FECHA_REFERENCIA_LABEL" queda dueño de
// orden-compra.resolver.ts (primer documento en usarlo); la plantilla de
// Cierre Comercial lo importa desde acá para no acoplarse a ese archivo.
export { FECHA_REFERENCIA_LABEL }
