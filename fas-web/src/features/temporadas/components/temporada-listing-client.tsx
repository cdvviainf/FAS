'use client'

import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { TemporadaFormSheet } from './temporada-form-sheet'
import { temporadaExtraColumns } from './temporada-columns'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

interface TemporadaItem extends MantenedorSimple {
  fechaInicio?: string
  fechaTermino?: string
}

export function TemporadaListingClient() {
  return (
    <MantenedorListing
      recurso='temporadas'
      titulo='Temporada'
      extraColumns={temporadaExtraColumns as never}
      renderEditSheet={({ item, open, onOpenChange }) => (
        <TemporadaFormSheet item={item as unknown as TemporadaItem} open={open} onOpenChange={onOpenChange} />
      )}
    />
  )
}
