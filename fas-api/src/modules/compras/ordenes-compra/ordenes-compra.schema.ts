import { z } from 'zod'

const lineaSchema = z.object({
  especieId: z.number().int().positive('La especie es requerida'),
  variedadId: z.number().int().positive('La variedad es requerida'),
  categoriaId: z.number().int().positive('La categoría es requerida'),
  articuloId: z.number().int().positive('El artículo de embalaje es requerido'),
  calibreMinId: z.number().int().positive('El calibre mínimo es requerido'),
  calibreMaxId: z.number().int().positive('El calibre máximo es requerido'),
  cantidadPallets: z.number().int().positive('La cantidad de pallets debe ser mayor a 0'),
  cajasPorPallet: z.number().int().positive('Las cajas por pallet deben ser mayor a 0'),
  precioUsdCaja: z.number().nonnegative('El precio no puede ser negativo'),
})

const cuotaPagoSchema = z.object({
  porcentaje: z.number().positive('El porcentaje debe ser mayor a 0').max(100, 'El porcentaje no puede superar 100'),
  plazoDias: z.number().int().nonnegative('El plazo en días no puede ser negativo'),
  descripcion: z.string().max(200).trim().optional().nullable(),
})

export const ordenCompraCreateSchema = z.object({
  entidadProductorId: z.number().int().positive('El productor es requerido'),
  notaVentaId: z.number().int().positive().optional().nullable(),
  fecha: z.coerce.date().optional(),
  formaPago: z.string().max(100).trim().optional().nullable(),
  condicionPagoTexto: z.string().max(2000).trim().optional().nullable(),
  monedaId: z.number().int().positive('La moneda es requerida'),
  incotermId: z.number().int().positive().optional().nullable(),
  facturarAId: z.number().int().positive().optional().nullable(),
  observaciones: z.string().max(2000).trim().optional().nullable(),
  lineas: z.array(lineaSchema).min(1, 'La OC debe tener al menos una línea'),
  cuotasPago: z.array(cuotaPagoSchema).optional().default([]),
})

export const ordenCompraUpdateSchema = ordenCompraCreateSchema
  .omit({ lineas: true, cuotasPago: true })
  .partial()
  .extend({
    // RECEPCIONADA queda fuera de las transiciones manuales: solo la
    // asignará el futuro flujo de Recepción de Stock (compras.md §4.4/§8),
    // no este endpoint (OC-001).
    estado: z.enum(['BORRADOR', 'EMITIDA']).optional(),
    lineas: z.array(lineaSchema).min(1).optional(),
    cuotasPago: z.array(cuotaPagoSchema).optional(),
  })

export const ordenCompraParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const ordenCompraListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  entidadProductorId: z.coerce.number().int().positive().optional(),
  estado: z.enum(['BORRADOR', 'EMITIDA', 'RECEPCIONADA']).optional(),
})

export type OrdenCompraCreateBody = z.infer<typeof ordenCompraCreateSchema>
export type OrdenCompraUpdateBody = z.infer<typeof ordenCompraUpdateSchema>
