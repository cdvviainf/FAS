'use client'

import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { EspecieFormSheet } from './especie-form-sheet'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

interface EspecieItem extends MantenedorSimple {
  unidadMedidaCalidadId?: number | null
  unidadMedidaCalidad?: { id: number; descripcion: string; codigo: string }
}

export function EspecieListingClient() {
  return (
    <MantenedorListing
      recurso='especies'
      titulo='Especie'
      renderEditSheet={({ item, open, onOpenChange }) => (
        <EspecieFormSheet
          item={item as unknown as EspecieItem}
          open={open}
          onOpenChange={onOpenChange}
        />
      )}
    />
  )
}
