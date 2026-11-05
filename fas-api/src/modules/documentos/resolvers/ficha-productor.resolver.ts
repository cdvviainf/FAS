import { NotFoundError } from '../../../shared/errors.js'
import { getFicha } from '../../productores/productores.repository.js'
import { getEmpresaParaDocumento, logoDataUri } from '../documentos.repository.js'
import type { ResolverOpciones } from '../documentos.types.js'
import type { FichaProductorPdfPayload } from '../schemas/ficha-productor.schema.js'
import { descripcionComercialArticulo } from '../../../shared/articulo-descripcion.js'

// Resolver de la Ficha de Productor — datos maestros: identificación,
// direcciones/contactos, predios y contrato vigente. Reusa getFicha del módulo
// Productores, que ya trae todo con sus relaciones. Sin cuenta corriente (ver
// schema). id = entidadId del productor.
export async function resolverFichaProductor(id: number, empresaId: number, opciones: ResolverOpciones): Promise<FichaProductorPdfPayload> {
  const [ficha, empresa] = await Promise.all([
    getFicha(id),
    getEmpresaParaDocumento(empresaId),
  ])
  if (!ficha) throw new NotFoundError('Productor', String(id))

  // Contrato tiene permiso propio (PROD_CONTRATO): si el solicitante no lo
  // tiene, se omite del PDF — mismo criterio que la ficha JSON (PROD-01,
  // productores.controller.ts). Ausencia de accesos ⇒ fail-closed.
  const puedeVerContrato = (opciones.accesos?.get('PROD_CONTRATO') ?? 'SIN_ACCESO') !== 'SIN_ACCESO'
  // Contrato vigente = el que cubre la fecha de hoy por [inicio, término]; si
  // ninguno aplica (p. ej. todos vencidos), el más reciente (getFicha ya ordena
  // por creadoEn desc).
  const hoy = new Date()
  const contrato = !puedeVerContrato
    ? null
    : ficha.contratos.find((c) => c.fechaInicio <= hoy && c.fechaTermino >= hoy) ?? ficha.contratos[0] ?? null

  return {
    fechaGeneracion: new Date().toISOString(),
    empresa: {
      razonSocial: empresa?.razonSocial ?? '—',
      rut: empresa?.rut ?? null,
      direccion: empresa?.direcciones[0]?.direccion ?? null,
      logoDataUri: logoDataUri(empresa?.logo),
    },
    productor: {
      codigo: ficha.codigo,
      razonSocial: ficha.razonSocial,
      descripcion: ficha.descripcion,
      rut: ficha.identificador ?? null,
      activo: ficha.activo,
      pais: ficha.pais?.descripcion ?? null,
      telefono: ficha.telefono ?? null,
      email: ficha.email ?? null,
      direcciones: ficha.direcciones.map((dir) => ({
        descripcion: dir.descripcion,
        direccion: dir.direccion,
        comuna: dir.comuna?.descripcion ?? null,
        pais: dir.pais?.descripcion ?? null,
      })),
      contactos: ficha.contactos.map((c) => ({
        nombre: c.nombre,
        tipo: c.tipo ?? null,
        rut: c.rut ?? null,
        telefono: c.telefono ?? null,
        email: c.email ?? null,
        esRepresentanteLegal: c.esRepresentanteLegal,
      })),
    },
    predios: ficha.predios.map((p) => ({
      codigo: p.codigo,
      descripcion: p.descripcion,
      direccion: p.direccion ?? null,
      comuna: p.comuna?.descripcion ?? null,
      tipoProduccion: p.tipoProduccion?.descripcion ?? null,
    })),
    contrato: contrato
      ? {
          temporada: contrato.temporada.descripcion,
          especie: contrato.especie.descripcion,
          fechaInicio: contrato.fechaInicio.toISOString(),
          fechaTermino: contrato.fechaTermino.toISOString(),
          lineas: contrato.lineas.map((l) => ({
            articulo: descripcionComercialArticulo(l.articulo),
            variedad: l.variedad.descripcion,
            calibre: l.calibreDesde.id === l.calibreHasta.id
              ? l.calibreDesde.descripcion
              : `${l.calibreDesde.descripcion} — ${l.calibreHasta.descripcion}`,
            categoria: l.categoria.descripcion,
            unidad: l.unidadMedida.descripcion,
            cantidadComprometida: l.cantidadComprometida.toString(),
            minimoGarantizado: l.minimoGarantizado.toString(),
          })),
        }
      : null,
  }
}
