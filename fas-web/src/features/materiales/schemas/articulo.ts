import * as z from 'zod';

export const articuloSchema = z
  .object({
    tipo: z.enum(['EMBALAJE', 'ENVASE', 'MATERIAL_EMBALAJE', 'SERVICIO']),
    codigo: z.string().min(1, 'El código es requerido').max(20),
    descripcion: z.string().min(1, 'La descripción es requerida').max(200),
    descripcionExtranjera: z.string().max(200).optional(),
    unidad: z.string().min(1, 'La unidad es requerida'),
    tipoCosteo: z.enum(['PROMEDIO_PONDERADO', 'ESTANDAR']),
    valorEstandar: z.number().positive().optional(),
    stockCritico: z.number().min(0).optional(),
    activo: z.boolean()
  })
  .refine(
    (data) => {
      if (data.tipoCosteo === 'ESTANDAR' && !data.valorEstandar) return false;
      return true;
    },
    { message: 'El valor estándar es requerido para costeo ESTÁNDAR', path: ['valorEstandar'] }
  )
  .refine(
    (data) => {
      if (data.tipo === 'SERVICIO' && data.tipoCosteo !== 'ESTANDAR') return false;
      return true;
    },
    { message: 'Los servicios solo admiten costeo ESTÁNDAR', path: ['tipoCosteo'] }
  );

export type ArticuloFormValues = z.infer<typeof articuloSchema>;
