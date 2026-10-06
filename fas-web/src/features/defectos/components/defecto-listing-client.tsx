'use client'

import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { DefectoFormSheet, type DefectoItem } from './defecto-form-sheet'
import { defectoExtraColumns } from './defecto-columns'

export function DefectoListingClient() {
  return (
    <MantenedorListing
      recurso='defectos'
      titulo='Defecto'
      extraColumns={defectoExtraColumns}
      renderEditSheet={({ item, open, onOpenChange }) => (
        <DefectoFormSheet
          item={item as unknown as DefectoItem}
          open={open}
          onOpenChange={onOpenChange}
        />
      )}
    />
  )
}
