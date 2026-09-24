import { queryOptions } from '@tanstack/react-query'
import { proformaService } from './service'
import type { DimensionProforma, ProformasListFilters } from './types'

export const proformasKeys = {
  all: ['proformas'] as const,
  list: (filters: object) => ['proformas', 'list', filters] as const,
  porEmbarque: (embarqueId: number) => ['proformas', 'embarque', embarqueId] as const,
  detalle: (id: number) => ['proformas', 'detalle', id] as const,
  sugerencia: (embarqueId: number, dimensiones: DimensionProforma[]) =>
    ['proformas', 'sugerencia', embarqueId, dimensiones] as const,
}

export function proformasListOptions(filters: ProformasListFilters = {}) {
  return queryOptions({
    queryKey: proformasKeys.list(filters),
    queryFn: () => proformaService.list(filters),
    staleTime: 15_000,
  })
}

export function proformaPorEmbarqueOptions(embarqueId: number) {
  return queryOptions({
    queryKey: proformasKeys.porEmbarque(embarqueId),
    queryFn: () => proformaService.obtenerPorEmbarque(embarqueId),
    staleTime: 10_000,
    enabled: embarqueId > 0,
  })
}

// Detalle histórico por id (FAS-PROF-EXP-003, QA ronda 2) — a diferencia de
// `proformaPorEmbarqueOptions`, trae la Proforma sea cual sea su estado
// (incluida ANULADA), para el link de cada fila del listado.
export function proformaPorIdOptions(id: number) {
  return queryOptions({
    queryKey: proformasKeys.detalle(id),
    queryFn: () => proformaService.obtenerPorId(id),
    staleTime: 10_000,
    enabled: id > 0,
  })
}
