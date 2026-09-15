import type { FastifyRequest, FastifyReply } from 'fastify'
import { ValidationError } from '../../../shared/errors.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { generarReporteErrores } from '../../../lib/carga-maestros/reporte-errores.js'
import { generarTemplateEntidadesDetalle, cargarEntidadesDetalle } from './carga-entidades-detalle.service.js'

// GET /carga-entidades-detalle/template → Excel con Direcciones/Contactos +
// hojas de referencia (Entidades/Comunas/Países) ya pobladas.
export async function descargarTemplate(_req: FastifyRequest, reply: FastifyReply) {
  const empresaId = getEmpresaIdActual()
  if (empresaId == null) throw new ValidationError('No hay empresa activa en la sesión')

  const buffer = await generarTemplateEntidadesDetalle(empresaId)
  return reply
    .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .header('Content-Disposition', 'attachment; filename="Carga_Direcciones_Contactos.xlsx"')
    .send(Buffer.from(buffer))
}

// POST /carga-entidades-detalle[?commit=true] (multipart) → valida o carga.
export async function procesar(req: FastifyRequest, reply: FastifyReply) {
  const empresaId = getEmpresaIdActual()
  if (empresaId == null) throw new ValidationError('No hay empresa activa en la sesión')

  const archivo = await req.file()
  if (!archivo) throw new ValidationError('No se recibió ningún archivo')
  const datos = await archivo.toBuffer()

  const commit = (req.query as { commit?: string }).commit === 'true'
  const resultado = await cargarEntidadesDetalle(datos, {
    empresaId,
    userId: req.fasUserId ?? 'sistema',
    dryRun: !commit,
  })
  return reply.send({ data: resultado })
}

// POST /carga-entidades-detalle/reporte (multipart) → Excel de errores.
export async function descargarReporte(req: FastifyRequest, reply: FastifyReply) {
  const empresaId = getEmpresaIdActual()
  if (empresaId == null) throw new ValidationError('No hay empresa activa en la sesión')

  const archivo = await req.file()
  if (!archivo) throw new ValidationError('No se recibió ningún archivo')
  const datos = await archivo.toBuffer()

  const resultado = await cargarEntidadesDetalle(datos, { empresaId, dryRun: true })
  const reporte = await generarReporteErrores(resultado.errores)
  return reply
    .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .header('Content-Disposition', 'attachment; filename="Reporte_Errores_Direcciones_Contactos.xlsx"')
    .send(Buffer.from(reporte))
}
