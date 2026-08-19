import { NotFoundError } from '../../../shared/errors.js'
import { getInstructivoById } from '../../compras/instructivo-embalaje/instructivo-embalaje.repository.js'
import { getEmpresaParaDocumento, getEntidadParaDocumento, logoDataUri } from '../documentos.repository.js'
import type { InstructivoEmbalajePdfPayload } from '../schemas/instructivo-embalaje.schema.js'

// Resolver del Instructivo de Embalaje — mismo criterio que
// orden-compra.resolver.ts: consulta la base, arma un payload tipado, sin
// lógica de presentación.
export async function resolverInstructivoEmbalaje(id: number, empresaId: number): Promise<InstructivoEmbalajePdfPayload> {
  const instructivo = await getInstructivoById(id)
  if (!instructivo) throw new NotFoundError('Instructivo de Embalaje', String(id))

  const [empresa, productor] = await Promise.all([
    getEmpresaParaDocumento(empresaId),
    getEntidadParaDocumento(instructivo.entidadProductorId),
  ])

  const detalle = instructivo.detalle.map((d) => ({
    especie: d.especie.descripcion,
    variedad: d.variedad.descripcion,
    variedadRotulada: d.variedadRotulada?.descripcion ?? null,
    categoria: d.categoria.descripcion,
    articulo: d.articulo.descripcion,
    etiqueta: d.articulo.etiqueta?.descripcion ?? null,
    calibres: d.calibres.map((c) => c.calibre.codigo).join(', '),
    tipoPallet: d.tipoPallet?.descripcion ?? null,
    altura: d.altura.descripcion,
    cantidadPallets: d.cantidadPallets,
    cajasPorPallet: d.cajasPorPallet,
    cajas: d.cajas,
  }))

  const totales = detalle.reduce(
    (acc, d) => ({ pallets: acc.pallets + d.cantidadPallets, cajas: acc.cajas + d.cajas }),
    { pallets: 0, cajas: 0 },
  )

  return {
    empresa: {
      razonSocial: empresa?.razonSocial ?? '—',
      rut: empresa?.rut ?? null,
      direccion: empresa?.direcciones[0]?.direccion ?? null,
      logoDataUri: logoDataUri(empresa?.logo),
    },
    numero: String(instructivo.numero),
    fecha: instructivo.creadoEn.toISOString(),
    productor: {
      razonSocial: productor?.razonSocial ?? instructivo.entidadProductor.razonSocial,
      rut: productor?.identificador ?? null,
      direccion: productor?.direcciones[0]?.direccion ?? null,
      contacto: productor?.contactos[0]?.nombre ?? null,
    },
    grupoMercado: instructivo.grupoMercado.descripcion,
    fechaInicioPrograma: instructivo.fechaInicioPrograma.toISOString(),
    observaciones: instructivo.observaciones,
    detalle,
    totales,
  }
}
