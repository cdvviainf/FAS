import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { ValidationError } from '../../../shared/errors.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { generarTemplate } from '../../../lib/carga-maestros/generar-template.js'
import { generarReporteErrores } from '../../../lib/carga-maestros/reporte-errores.js'
import { REGISTRO_RECETAS_TEMPLATE } from '../../config/carga-maestros/registro.js'
import { cargarRecetas, construirDatosPlantillaRecetas } from './carga-recetas.service.js'

const templateQuerySchema = z.object({
  // "true" descarga el template con filas de ejemplo (códigos reales de la empresa).
  ejemplo: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
})

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

// GET /carga-recetas/template[?ejemplo=true] → descarga el Excel base: hoja
// Recetas + hoja de referencia Embalajes (dropdown en la columna Embalaje). Con
// ?ejemplo=true agrega filas de ejemplo con códigos reales de la empresa.
export async function descargarTemplate(req: FastifyRequest, reply: FastifyReply) {
  const empresaId = empresaActivaOFalla()
  const { ejemplo } = templateQuerySchema.parse(req.query)
  const datosPorHoja = await construirDatosPlantillaRecetas(empresaId, ejemplo)
  const buffer = await generarTemplate(REGISTRO_RECETAS_TEMPLATE, {
    listasEnum: {},
    datosPorHoja,
    titulo: 'CARGA DE RECETAS — FRUTERA AGROSAN',
    fueraDeAlcance: ['Artículos (Embalajes y Componentes): deben existir previamente'],
  })
  const filename = ejemplo ? 'Carga_Recetas_ejemplo.xlsx' : 'Carga_Recetas_base.xlsx'
  return reply
    .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .header('Content-Disposition', `attachment; filename="${filename}"`)
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
