import ExcelJS from 'exceljs'
import { generarTemplate } from '../../../lib/carga-maestros/generar-template.js'
import { empresaContext } from '../../../lib/empresa-context.js'
import { cargarMaestros, type OpcionesCarga, type ResultadoCarga } from '../carga-maestros/carga-maestros.service.js'
import * as configRepo from '../config.repository.js'
import * as entidadesRepo from '../entidades/entidades.repository.js'
import { REGISTRO_ENTIDADES_DETALLE } from './registro-entidades-detalle.js'

const TITULO = 'CARGA MASIVA DE DIRECCIONES Y CONTACTOS — FRUTERA AGROSAN'

/** Reúne los maestros existentes que alimentan las hojas de referencia. */
async function construirDatosReferencia(empresaId: number) {
  return empresaContext.run({ empresaId }, async () => {
    const [entidades, comunas, paises] = await Promise.all([
      entidadesRepo.findAllEntidades(1, 100_000),
      configRepo.listMantenedor('comuna', { page: 1, limit: 100_000 }),
      configRepo.listMantenedor('pais', { page: 1, limit: 100_000 }),
    ])
    return {
      Entidades: (entidades.data as Array<Record<string, unknown>>).map((e) => ({
        codigo: e.codigo,
        descripcion: e.descripcion,
        razonSocial: e.razonSocial,
        pais: (e.pais as { descripcion?: string } | null)?.descripcion ?? '',
      })),
      Comunas: (comunas.data as Array<Record<string, unknown>>).map((c) => ({
        codigo: c.codigo,
        descripcion: c.descripcion,
      })),
      Paises: (paises.data as Array<Record<string, unknown>>).map((p) => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
      })),
    }
  })
}

/** Genera el Excel de Direcciones/Contactos con las hojas de referencia llenas. */
export async function generarTemplateEntidadesDetalle(empresaId: number): Promise<ExcelJS.Buffer> {
  const datosPorHoja = await construirDatosReferencia(empresaId)
  return generarTemplate(REGISTRO_ENTIDADES_DETALLE, {
    listasEnum: {},
    datosPorHoja,
    titulo: TITULO,
    fueraDeAlcance: [],
  })
}

/** Valida (dry-run) o carga el Excel de Direcciones/Contactos. */
export async function cargarEntidadesDetalle(
  rutaOBuffer: string | Buffer,
  opciones: OpcionesCarga,
): Promise<ResultadoCarga> {
  return cargarMaestros(rutaOBuffer, opciones, REGISTRO_ENTIDADES_DETALLE)
}
