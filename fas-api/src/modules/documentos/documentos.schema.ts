import { z } from 'zod'

export const documentoParamsSchema = z.object({
  tipo: z.string(),
  id: z.coerce.number().int().positive(),
})

// Fastify (find-my-way) ya separa el sufijo estático de un segmento
// combinado como ":id.pdf" — el param llega limpio ("123", sin ".pdf"),
// verificado con una prueba directa del router. Incluso el segmento
// completo ":documentoEmitidoId.pdf" (dos partes de nombre) se resuelve
// igual de limpio.
export const documentoPdfParamsSchema = z.object({
  tipo: z.string(),
  id: z.coerce.number().int().positive(),
})

export const documentoEmitidoParamsSchema = z.object({
  documentoEmitidoId: z.coerce.number().int().positive(),
})
