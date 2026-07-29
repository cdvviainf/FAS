'use client'

import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { VariedadFormSheet } from './variedad-form-sheet'
import { variedadExtraColumns } from './variedad-columns'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

interface VariedadItem extends MantenedorSimple {
  especieId?: number
  grupoVariedadId?: number
  especie?: { id: number; descripcion: string }
  grupoVariedad?: { id: number; descripcion: string }
}

export function VariedadListingClient() {
  return (
    <MantenedorListing
      recurso='variedades'
      titulo='Variedad'
      extraColumns={variedadExtraColumns}
      renderEditSheet={({ item, open, onOpenChange }) => (
        <VariedadFormSheet
          item={item as unknown as VariedadItem}
          open={open}
          onOpenChange={onOpenChange}
        />
      )}
    />
  )
}
