'use client'

import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { CalibreFormSheet } from './calibre-form-sheet'
import { calibreExtraColumns } from './calibre-columns'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

interface CalibreItem extends MantenedorSimple {
  especieId?: number
  orden?: number
  control?: string[]
  especie?: { id: number; descripcion: string }
}

export function CalibreListingClient() {
  return (
    <MantenedorListing
      recurso='calibres'
      titulo='Calibre'
      extraColumns={calibreExtraColumns}
      renderEditSheet={({ item, open, onOpenChange }) => (
        <CalibreFormSheet
          item={item as unknown as CalibreItem}
          open={open}
          onOpenChange={onOpenChange}
        />
      )}
    />
  )
}
