import { Prisma } from '@prisma/client'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek.js'
import { NotFoundError } from '../../../shared/errors.js'
import { getInstructivoById } from '../../compras/instructivo-embalaje/instructivo-embalaje.repository.js'
import { getEmpresaParaDocumento, getEntidadParaDocumento, logoDataUri } from '../documentos.repository.js'
import type { InstructivoEmbalajePdfPayload } from '../schemas/instructivo-embalaje.schema.js'

dayjs.extend(isoWeek)

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
    // Descripción, no código (feedback Christian, 2026-08-19) — en las 3
    // plantillas del motor, no solo acá.
    calibres: d.calibres.map((c) => c.calibre.descripcion).join(', '),
    // Kg Neto Envase (feedback Christian, 2026-08-19) — dato de catálogo
    // (Articulo.kgNetoEnvase), sin cálculo de total (el Instructivo no
    // pidió Kg Bruto ni un total de kilos, a diferencia de OC/Cierre Comercial).
    kgNetoEnvase: d.articulo.kgNetoEnvase ? new Prisma.Decimal(d.articulo.kgNetoEnvase).toString() : null,
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
    // Semana ISO (feedback Christian, 2026-08-19) — mismo cálculo que ya usa
    // el formulario en pantalla (fas-web/instructivo-form.tsx, getISOWeek de
    // date-fns); acá con dayjs+isoWeek porque fas-api no depende de date-fns.
    // FAS-DOC-IMP-R1-002 (QA Codex, ronda 1): `fechaInicioPrograma` viaja
    // como instante UTC medianoche — pasarlo directo a dayjs() lo convierte
    // primero a la hora LOCAL del servidor, que puede caer en el día
    // calendario anterior (ej. server en America/Santiago: 17-ago 00:00 UTC
    // -> 16-ago 20:00 local -> semana equivocada). Mismo patrón que
    // fmt.fecha() (ui/formato.ts): tomar solo YYYY-MM-DD y parsearlo como
    // hora local evita el corrimiento de huso horario.
    semana: dayjs(`${instructivo.fechaInicioPrograma.toISOString().slice(0, 10)}T00:00:00`).isoWeek(),
    observaciones: instructivo.observaciones,
    detalle,
    totales,
  }
}
