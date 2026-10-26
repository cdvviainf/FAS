import type { FastifyRequest, FastifyReply } from 'fastify'
import { ValidationError } from '../../../shared/errors.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { generarTemplate } from '../../../lib/carga-maestros/generar-template.js'
import { generarReporteErrores } from '../../../lib/carga-maestros/reporte-errores.js'
import { REGISTRO_RECETAS } from '../../config/carga-maestros/registro.js'
import { cargarRecetas } from './carga-recetas.service.js'

// Carga de SOLO recetas: valida/crea recetas cuyo embalaje (cabecera) y
// componentes YA EXISTEN como artículos. El embalaje debe ser tipo EMBALAJE.

function empresaActivaOFalla(): number {
  const empresaId = getEmpresaIdActual()
  if (empresaId == null) throw new ValidationError('No hay empresa activa en la sesión')
  return empresaId
}

async function bufferDeArchivo(req: FastifyRequest): Promise<Buffer> {
  const archivo = await req.file()
  if (!archivo) throw new ValidationError('No se recibió ningún archivo')
  return archivo.toBuffer()
}

// GET /carga-recetas/template → descarga el Excel base (una hoja Recetas).
export async function descargarTemplate(_req: FastifyRequest, reply: FastifyReply) {
  const buffer = await generarTemplate(REGISTRO_RECETAS, {
    listasEnum: {},
    titulo: 'CARGA DE RECETAS — FRUTERA AGROSAN',
    fueraDeAlcance: ['Artículos (Embalajes y Componentes): deben existir previamente'],
  })
  return reply
    .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .header('Content-Disposition', 'attachment; filename="Carga_Recetas_base.xlsx"')
    .send(Buffer.from(buffer))
}

// POST /carga-recetas/validar (multipart) → dry-run (no escribe). Nivel LECTURA.
export async function validar(req: FastifyRequest, reply: FastifyReply) {
  const empresaId = empresaActivaOFalla()
  const datos = await bufferDeArchivo(req)
  const resultado = await cargarRecetas(datos, { empresaId, dryRun: true })
  return reply.send({ data: resultado })
}

// POST /carga-recetas (multipart) → carga a la base. Nivel TOTAL.
export async function cargar(req: FastifyRequest, reply: FastifyReply) {
  const empresaId = empresaActivaOFalla()
  const datos = await bufferDeArchivo(req)
  const resultado = await cargarRecetas(datos, { empresaId, userId: req.fasUserId ?? 'sistema', dryRun: false })
  return reply.send({ data: resultado })
}

// POST /carga-recetas/reporte (multipart) → Excel de errores de una validación.
export async function descargarReporte(req: FastifyRequest, reply: FastifyReply) {
  const empresaId = empresaActivaOFalla()
  const datos = await bufferDeArchivo(req)
  const resultado = await cargarRecetas(datos, { empresaId, dryRun: true })
  const reporte = await generarReporteErrores(resultado.errores)
  return reply
    .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .header('Content-Disposition', 'attachment; filename="Reporte_Errores_Carga_Recetas.xlsx"')
    .send(Buffer.from(reporte))
}
