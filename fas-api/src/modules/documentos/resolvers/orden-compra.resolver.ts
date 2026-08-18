import { Prisma } from '@prisma/client'
import { NotFoundError } from '../../../shared/errors.js'
import { getOrdenCompraById } from '../../compras/ordenes-compra/ordenes-compra.repository.js'
import { getEmpresaParaDocumento, getEntidadParaDocumento, logoDataUri } from '../documentos.repository.js'
import type { OrdenCompraPdfPayload } from '../schemas/orden-compra.schema.js'

export const FECHA_REFERENCIA_LABEL: Record<string, string> = {
  FACTURA: 'Factura',
  ZARPE: 'Zarpe',
  ENVIO_DOCUMENTOS: 'Envío de documentos',
}

// Resolver de Orden de Compra — Etapa 4 §4: "consulta la base y arma un
// payload tipado con Zod. Nada de lógica de presentación." Reusa
// ordenes-compra.repository.ts (repository pattern, CLAUDE.md §12.2) en vez
// de duplicar la query; getEmpresaParaDocumento/getEntidadParaDocumento
// (documentos.repository.ts) cubren solo lo que el PDF necesita y el
// endpoint normal de OC no expone (RUT, dirección por defecto).
export async function resolverOrdenCompra(id: number, empresaId: number): Promise<OrdenCompraPdfPayload> {
  const oc = await getOrdenCompraById(id)
  if (!oc) throw new NotFoundError('Orden de Compra', String(id))

  const [empresa, productor] = await Promise.all([
    getEmpresaParaDocumento(empresaId),
    getEntidadParaDocumento(oc.entidadProductorId),
  ])

  // Cálculo en Decimal (CLAUDE.md §12.5) — nunca number de JS. Kg Neto/Bruto
  // por línea = cajas × kg del envase (Articulo.kgNetoEnvase/kgBrutoEnvase),
  // mismo cálculo que el ejemplo real (Docs/AGROSAN 002 -OC5.pdf: 240 cajas ×
  // 2,50 kg = 600 kg neto).
  const calculadas = oc.lineas.map((l) => {
    const kgNetoEnvase = l.articulo.kgNetoEnvase ? new Prisma.Decimal(l.articulo.kgNetoEnvase) : new Prisma.Decimal(0)
    const kgBrutoEnvase = l.articulo.kgBrutoEnvase ? new Prisma.Decimal(l.articulo.kgBrutoEnvase) : new Prisma.Decimal(0)
    return {
      l,
      totalUsd: new Prisma.Decimal(l.precioUsdCaja).mul(l.cajas),
      kgNeto: kgNetoEnvase.mul(l.cajas),
      kgBruto: kgBrutoEnvase.mul(l.cajas),
    }
  })

  const lineas = calculadas.map(({ l, totalUsd, kgNeto, kgBruto }) => ({
    especie: l.especie.descripcion,
    variedad: l.variedad.descripcion,
    articulo: l.articulo.descripcion,
    etiqueta: l.articulo.etiqueta?.descripcion ?? null,
    calibres: l.calibres.map((c) => c.calibre.codigo).join(', '),
    categoria: l.categoria.descripcion,
    cantidadPallets: l.cantidadPallets,
    cajas: l.cajas,
    precioUsdCaja: new Prisma.Decimal(l.precioUsdCaja).toString(),
    totalUsd: totalUsd.toString(),
    kgNeto: kgNeto.toString(),
    kgBruto: kgBruto.toString(),
  }))

  const totales = calculadas.reduce(
    (acc, c) => ({
      pallets: acc.pallets + c.l.cantidadPallets,
      cajas: acc.cajas + c.l.cajas,
      totalUsd: acc.totalUsd.add(c.totalUsd),
      kgNeto: acc.kgNeto.add(c.kgNeto),
      kgBruto: acc.kgBruto.add(c.kgBruto),
    }),
    { pallets: 0, cajas: 0, totalUsd: new Prisma.Decimal(0), kgNeto: new Prisma.Decimal(0), kgBruto: new Prisma.Decimal(0) },
  )

  return {
    empresa: {
      razonSocial: empresa?.razonSocial ?? '—',
      rut: empresa?.rut ?? null,
      direccion: empresa?.direcciones[0]?.direccion ?? null,
      logoDataUri: logoDataUri(empresa?.logo),
    },
    numero: oc.numero,
    fecha: oc.fecha.toISOString(),
    responsable: oc.responsable?.nombre ?? null,
    productor: {
      razonSocial: productor?.razonSocial ?? oc.entidadProductor.razonSocial,
      rut: productor?.identificador ?? null,
      direccion: productor?.direcciones[0]?.direccion ?? null,
      contacto: productor?.contactos[0]?.nombre ?? null,
    },
    formaPago: oc.formaPago?.descripcion ?? null,
    moneda: oc.moneda.codigo,
    incoterm: oc.incoterm?.descripcion ?? null,
    destinoMercado: oc.destinoMercado?.descripcion ?? null,
    cuotas: oc.cuotasPago.map((c) => ({
      plazoDias: c.plazoDias,
      fechaReferencia: c.fechaReferencia,
      tipoValor: c.tipoValor,
      porcentaje: c.porcentaje ? c.porcentaje.toString() : null,
      valorUnitario: c.valorUnitario ? c.valorUnitario.toString() : null,
      unidad: c.unidad?.descripcion ?? null,
    })),
    observaciones: oc.observaciones,
    lineas,
    totales: {
      pallets: totales.pallets,
      cajas: totales.cajas,
      totalUsd: totales.totalUsd.toString(),
      kgNeto: totales.kgNeto.toString(),
      kgBruto: totales.kgBruto.toString(),
    },
  }
}
