import { Prisma } from '@prisma/client'
import { NotFoundError } from '../../../shared/errors.js'
import { getOrdenCompraMaterialById } from '../../materiales/ordenes-compra/ordenes-compra.repository.js'
import { getEmpresaParaDocumento, getEntidadParaDocumento, logoDataUri } from '../documentos.repository.js'
import type { OrdenCompraMaterialPdfPayload } from '../schemas/orden-compra-material.schema.js'

// Resolver de Orden de Compra de Materiales — mismo patrón que
// orden-compra.resolver.ts (fruta): reusa ordenes-compra.repository.ts de
// Materiales (repository pattern, CLAUDE.md §12.2) en vez de duplicar la
// query, y getEmpresaParaDocumento/getEntidadParaDocumento para los datos
// que el endpoint normal de la OC no expone (RUT, dirección, contacto).
export async function resolverOrdenCompraMaterial(id: number, empresaId: number): Promise<OrdenCompraMaterialPdfPayload> {
  const oc = await getOrdenCompraMaterialById(id)
  if (!oc) throw new NotFoundError('Orden de Compra de Materiales', String(id))

  const [empresa, proveedor] = await Promise.all([
    getEmpresaParaDocumento(empresaId),
    getEntidadParaDocumento(oc.entidadProveedorId),
  ])

  const lineas = oc.lineas.map((l) => ({
    articulo: `${l.articulo.codigo} — ${l.articulo.descripcion}`,
    unidad: l.articulo.unidad.codigo,
    cantidad: new Prisma.Decimal(l.cantidad).toString(),
    precioUnitario: new Prisma.Decimal(l.precioUnitario).toString(),
    monto: new Prisma.Decimal(l.monto).toString(),
  }))
  const totales = oc.lineas.reduce(
    (acc, l) => ({
      cantidad: acc.cantidad.add(l.cantidad),
      monto: acc.monto.add(l.monto),
    }),
    { cantidad: new Prisma.Decimal(0), monto: new Prisma.Decimal(0) },
  )

  return {
    empresa: {
      codigo: empresa?.codigo ?? '',
      razonSocial: empresa?.razonSocial ?? '—',
      rut: empresa?.rut ?? null,
      direccion: empresa?.direcciones[0]?.direccion ?? null,
      logoDataUri: logoDataUri(empresa?.logo),
    },
    numero: oc.numero,
    fecha: oc.fecha.toISOString(),
    proveedor: {
      razonSocial: proveedor?.razonSocial ?? oc.entidadProveedor.razonSocial,
      rut: proveedor?.identificador ?? null,
      direccion: proveedor?.direcciones[0]?.direccion ?? null,
      contacto: proveedor?.contactos[0]?.nombre ?? null,
    },
    formaPago: oc.formaPago?.descripcion ?? null,
    moneda: oc.moneda.codigo,
    condicionPago: oc.condicionPago?.descripcion ?? null,
    observaciones: oc.observaciones,
    cuotas: oc.cuotasPago.map((c) => ({
      plazoDias: c.plazoDias,
      fechaReferencia: c.fechaReferencia,
      porcentaje: c.porcentaje.toString(),
    })),
    lineas,
    totales: {
      cantidad: totales.cantidad.toString(),
      monto: totales.monto.toString(),
    },
  }
}
