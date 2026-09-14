import type { FastifyRequest, FastifyReply } from 'fastify'
import { ValidationError } from '../../../shared/errors.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { generarTemplate } from '../../../lib/carga-maestros/generar-template.js'
import { generarReporteErrores } from '../../../lib/carga-maestros/reporte-errores.js'
import { cargarMaestros } from './carga-maestros.service.js'
import {
  REGISTRO_MAESTROS,
  ENUM_TIPO_ARTICULO,
  ENUM_TIPO_COSTEO,
  ENUM_TIPO_ENTIDAD,
  ENUM_TIPO_BODEGA,
  ENUM_MODELO_PREFIJO,
} from './registro.js'

const LISTAS_ENUM = {
  TipoArticulo: ENUM_TIPO_ARTICULO,
  TipoCosteo: ENUM_TIPO_COSTEO,
  TipoEntidad: ENUM_TIPO_ENTIDAD,
  TipoBodega: ENUM_TIPO_BODEGA,
  ModeloPrefijo: ENUM_MODELO_PREFIJO,
}

// GET /carga-maestros/template → descarga el Excel base vacío.
export async function descargarTemplate(_req: FastifyRequest, reply: FastifyReply) {
  const buffer = await generarTemplate(REGISTRO_MAESTROS, { listasEnum: LISTAS_ENUM })
  return reply
    .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .header('Content-Disposition', 'attachment; filename="Carga_Masiva_Maestros_base.xlsx"')
    .send(Buffer.from(buffer))
}

// POST /carga-maestros[?commit=true] (multipart) → valida (dry-run) o carga.
export async function procesar(req: FastifyRequest, reply: FastifyReply) {
  const empresaId = getEmpresaIdActual()
  if (empresaId == null) throw new ValidationError('No hay empresa activa en la sesión')

  const archivo = await req.file()
  if (!archivo) throw new ValidationError('No se recibió ningún archivo')
  const datos = await archivo.toBuffer()

  const commit = (req.query as { commit?: string }).commit === 'true'
  const resultado = await cargarMaestros(datos, {
    empresaId,
    userId: req.fasUserId ?? 'sistema',
    dryRun: !commit,
  })
  return reply.send({ data: resultado })
}

// POST /carga-maestros/reporte (multipart) → devuelve el Excel de errores de una
// validación (dry-run) del archivo subido, para descargar.
export async function descargarReporte(req: FastifyRequest, reply: FastifyReply) {
  const empresaId = getEmpresaIdActual()
  if (empresaId == null) throw new ValidationError('No hay empresa activa en la sesión')

  const archivo = await req.file()
  if (!archivo) throw new ValidationError('No se recibió ningún archivo')
  const datos = await archivo.toBuffer()

  const resultado = await cargarMaestros(datos, { empresaId, dryRun: true })
  const reporte = await generarReporteErrores(resultado.errores)
  return reply
    .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .header('Content-Disposition', 'attachment; filename="Reporte_Errores_Carga_Masiva.xlsx"')
    .send(Buffer.from(reporte))
}
