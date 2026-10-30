import { queryOptions } from '@tanstack/react-query'
import { facturaNacionalService } from './service'
import type { FacturasNacionalListFilters, OperacionesNacionalFilters } from './types'

export const facturasNacionalKeys = {
  all: ['facturas-nacional'] as const,
  list: (filters: object) => ['facturas-nacional', 'list', filters] as const,
  facturables: (filters: object) => ['facturas-nacional', 'facturables', filters] as const,
  embarquesFacturables: (filters: object) => ['facturas-nacional', 'embarques-facturables', filters] as const,
  operaciones: (filters: object) => ['facturas-nacional', 'operaciones', filters] as const,
  detalle: (id: number) => ['facturas-nacional', 'detalle', id] as const,
}

export function operacionesNacionalOptions(filters: OperacionesNacionalFilters = {}) {
  return queryOptions({
    queryKey: facturasNacionalKeys.operaciones(filters),
    queryFn: () => facturaNacionalService.listOperaciones(filters),
    staleTime: 10_000,
  })
}

export function facturasNacionalListOptions(filters: FacturasNacionalListFilters = {}) {
  return queryOptions({
    queryKey: facturasNacionalKeys.list(filters),
    queryFn: () => facturaNacionalService.list(filters),
    staleTime: 15_000,
  })
}

export function proformasFacturablesOptions(filters: { page?: number; limit?: number; q?: string } = {}) {
  return queryOptions({
    queryKey: facturasNacionalKeys.facturables(filters),
    queryFn: () => facturaNacionalService.listProformasFacturables(filters),
    staleTime: 10_000,
  })
}

export function embarquesFacturablesOptions(filters: { page?: number; limit?: number; q?: string } = {}) {
  return queryOptions({
    queryKey: facturasNacionalKeys.embarquesFacturables(filters),
    queryFn: () => facturaNacionalService.listEmbarquesFacturables(filters),
    staleTime: 10_000,
  })
}

export function facturaNacionalPorIdOptions(id: number) {
  return queryOptions({
    queryKey: facturasNacionalKeys.detalle(id),
    queryFn: () => facturaNacionalService.obtenerPorId(id),
    staleTime: 10_000,
    enabled: id > 0,
  })
}
