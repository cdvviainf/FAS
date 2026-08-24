import { z } from 'zod'

const filtrosBase = {
  productorId: z.coerce.number().int().positive().optional(),
  especieId: z.coerce.number().int().positive().optional(),
  variedadId: z.coerce.number().int().positive().optional(),
  categoriaId: z.coerce.number().int().positive().optional(),
  calibreId: z.coerce.number().int().positive().optional(),
  origen: z.enum(['COMPRA', 'CONSIGNACION', 'PROCESO']).optional(),
  fechaDesde: z.coerce.date().optional(),
  fechaHasta: z.coerce.date().optional(),
}

export const stockResumenQuerySchema = z.object(filtrosBase)

// Drill-down de una fila del resumen — exige la combinación completa para
// saber cuál grupo se está expandiendo (stock.md, reporte en pantalla).
export const stockDetalleQuerySchema = z.object({
  ...filtrosBase,
  especieId: z.coerce.number().int().positive(),
  variedadId: z.coerce.number().int().positive(),
  categoriaId: z.coerce.number().int().positive(),
  calibreId: z.coerce.number().int().positive(),
})
