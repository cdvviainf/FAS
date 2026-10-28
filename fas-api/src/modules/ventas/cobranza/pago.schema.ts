import { z } from 'zod'

// Escala máxima (decimales) de un número, para calzar con las columnas Decimal
// (mismo helper que factura-nacional.schema.ts). Maneja notación exponencial.
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

// Monto en una columna Decimal(14,2): hasta 12 enteros y 2 decimales.
const monto2 = z
  .number()
  .max(999_999_999_999.99, 'El monto excede el máximo permitido')
  .refine(escalaMax(2), 'El monto admite a lo más 2 decimales')

export const pagoParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const clienteParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const saldoAFavorParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

const aplicacionSchema = z.object({
  tipoFactura: z.enum(['EXPORTACION', 'NACIONAL']),
  facturaId: z.number().int().positive(),
  montoAplicado: monto2.refine((n) => n > 0, 'El monto aplicado debe ser mayor a 0'),
  // tipoCambio pago→factura. Decimal(14,6): default 1 (misma moneda).
  tipoCambio: z
    .number()
    .positive('El tipo de cambio debe ser mayor a 0')
    .max(99_999_999.999999)
    .refine(escalaMax(6), 'El tipo de cambio admite a lo más 6 decimales')
    .default(1),
})

export const crearPagoSchema = z.object({
  clienteId: z.number().int().positive('El cliente es requerido'),
  fecha: z.string().date(),
  monto: monto2.refine((n) => n > 0, 'El monto del pago debe ser mayor a 0'),
  monedaId: z.number().int().positive('La moneda es requerida'),
  medioPago: z.enum(['TRANSFERENCIA', 'CHEQUE', 'EFECTIVO', 'OTRO']),
  referencia: z.string().max(200).optional().nullable(),
  observacion: z.string().max(2000).optional().nullable(),
  // Puede ir vacío: un pago sin aplicaciones es un anticipo (todo a saldo a favor).
  aplicaciones: z
    .array(aplicacionSchema)
    .max(100)
    .default([])
    // No se puede aplicar dos veces a la misma factura dentro de un mismo pago
    // (se consolidaría en una sola aplicación — evitamos la ambigüedad).
    .refine(
      (arr) => new Set(arr.map((a) => `${a.tipoFactura}:${a.facturaId}`)).size === arr.length,
      'No se puede aplicar el mismo pago dos veces a la misma factura',
    ),
})

export const aplicarSaldoAFavorSchema = z.object({
  tipoFactura: z.enum(['EXPORTACION', 'NACIONAL']),
  facturaId: z.number().int().positive(),
  monto: monto2.refine((n) => n > 0, 'El monto a aplicar debe ser mayor a 0'),
})

export const pagosListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  clienteId: z.coerce.number().int().positive().optional(),
  desde: z.string().date().optional(),
  hasta: z.string().date().optional(),
})

export const documentosPendientesQuerySchema = z.object({
  // Filtro opcional por moneda (la pantalla de pago fija primero la moneda).
  monedaId: z.coerce.number().int().positive().optional(),
})
