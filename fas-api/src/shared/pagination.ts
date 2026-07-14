import { z } from 'zod'

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type PaginationParams = z.infer<typeof paginationSchema>

export function paginate(params: PaginationParams) {
  const { page, limit } = params
  return {
    skip: (page - 1) * limit,
    take: limit,
  }
}

export function buildMeta(total: number, params: PaginationParams) {
  const { page, limit } = params
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}
