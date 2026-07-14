'use client'

import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { BodegaFormSheet } from './bodega-form-sheet'
import { bodegaExtraColumns } from './bodega-columns'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

interface BodegaItem extends MantenedorSimple {
  comunaId?: number
  direccion?: string
  tipos?: string[]
  latitud?: number | null
  longitud?: number | null
  comuna?: { id: number; descripcion: string; provincia?: { id: number; descripcion: string; region?: { id: number; descripcion: string } } }
}

export function BodegaListingClient() {
  return (
    <MantenedorListing
      recurso='bodegas'
      titulo='Bodega'
      extraColumns={bodegaExtraColumns as never}
      renderEditSheet={({ item, open, onOpenChange }) => (
        <BodegaFormSheet item={item as unknown as BodegaItem} open={open} onOpenChange={onOpenChange} />
      )}
    />
  )
}
