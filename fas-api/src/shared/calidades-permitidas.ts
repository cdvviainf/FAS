import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { ValidationError } from './errors.js'

// "Calidad permitida" = par (NotaCalidad, NotaCondicion). Concepto compartido por
// Cierre Comercial (NotaVenta), Solicitud de Inspección e Instructivo de Embalaje:
// define combinaciones específicas admitidas (ej. A1/A2/B1, sin B2), superando la
// selección independiente de dos listas (que daba el producto cartesiano).

export const parCalidadSchema = z.object({
  notaCalidadId: z.number().int().positive(),
  notaCondicionId: z.number().int().positive(),
})

export type ParCalidad = z.infer<typeof parCalidadSchema>

// Valida que cada NotaCalidad y NotaCondicion de los pares exista, esté vigente
// (no eliminada/bloqueada) y pertenezca a la empresa activa (la extensión de
// tenancy filtra por empresa). No admite pares duplicados. Lanza ValidationError.
export async function validarCalidadesPermitidas(pares: ParCalidad[]): Promise<void> {
  if (pares.length === 0) return

  const claves = new Set<string>()
  for (const p of pares) {
    const clave = `${p.notaCalidadId}-${p.notaCondicionId}`
    if (claves.has(clave)) throw new ValidationError('Hay calidades permitidas repetidas (misma combinación Calidad + Condición)')
    claves.add(clave)
  }

  const calidadIds = [...new Set(pares.map((p) => p.notaCalidadId))]
  const condicionIds = [...new Set(pares.map((p) => p.notaCondicionId))]
  const [calidades, condiciones] = await Promise.all([
    prisma.notaCalidad.findMany({ where: { id: { in: calidadIds }, eliminadoEn: null, bloqueado: false }, select: { id: true } }),
    prisma.notaCondicion.findMany({ where: { id: { in: condicionIds }, eliminadoEn: null, bloqueado: false }, select: { id: true } }),
  ])
  if (calidades.length !== calidadIds.length) {
    throw new ValidationError('Una o más Notas de Calidad seleccionadas no existen o están bloqueadas')
  }
  if (condiciones.length !== condicionIds.length) {
    throw new ValidationError('Una o más Notas de Condición seleccionadas no existen o están bloqueadas')
  }
}
