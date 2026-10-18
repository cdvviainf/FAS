import { z } from 'zod'

export const facturaNacionalParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const crearBorradorSchema = z.object({
  proformaMaterialId: z.number().int().positive('La Proforma de Materiales es requerida'),
})

// Escala máxima (decimales) de un número, para calzar con las columnas Decimal.
// Maneja notación exponencial (p.ej. 1e-7, que no tiene punto decimal pero sí
// 7 decimales reales) reconstruyendo la escala desde el exponente.
const escalaMax = (max: number) => (n: number) => {
  if (!Number.isFinite(n)) return false
  const s = Math.abs(n).toString()
  const expMatch = s.match(/e([+-]?\d+)/i)
  if (expMatch) {
    const exp = parseInt(expMatch[1], 10)
    const decMant = (s.split(/e/i)[0].split('.')[1] ?? '').length
    return decMant - exp <= max
  }
  return (s.split('.')[1] ?? '').length <= max
}

export const lineaSchema = z.object({
  descripcion: z.string().min(1, 'La descripción es requerida').max(500),
  articuloId: z.number().int().positive().optional().nullable(),
  // Columna Decimal(14,3): hasta 11 enteros y 3 decimales.
  cantidad: z
    .number()
    .positive('La cantidad debe ser mayor a 0')
    .max(99_999_999_999, 'La cantidad excede el máximo permitido')
    .refine(escalaMax(3), 'La cantidad admite a lo más 3 decimales'),
  // Columna Decimal(14,4): hasta 10 enteros y 4 decimales.
  precioUnitario: z
    .number()
    .min(0, 'El precio no puede ser negativo')
    .max(9_999_999_999, 'El precio excede el máximo permitido')
    .refine(escalaMax(4), 'El precio admite a lo más 4 decimales'),
  exento: z.boolean(),
})

export const actualizarBorradorSchema = z.object({
  fechaDocumento: z.string().date().optional().nullable(),
  observaciones: z.string().max(5000).optional().nullable(),
  // Venta nacional: tipo de cambio (moneda de origen → CLP) editable antes de
  // emitir; recotiza las líneas. No aplica a facturas desde Proforma de Materiales.
  tipoCambio: z.number().positive().max(9_999_999_999).optional().nullable(),
  fechaTipoCambio: z.string().date().optional().nullable(),
  lineas: z.array(lineaSchema).optional(),
})

export const embarqueParamsSchema = z.object({
  embarqueId: z.coerce.number().int().positive(),
})

export const tipoCambioQuerySchema = z.object({
  fecha: z.string().date().optional(),
})

export const facturasNacionalListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  estado: z.enum(['BORRADOR', 'APROBADA', 'RECHAZADA', 'ANULADA']).optional(),
  q: z.string().max(200).optional(),
})

// Proformas de Materiales listas para facturar (ENVIADA_VALIDACION) para la landing.
export const proformasFacturablesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(200).optional(),
})
