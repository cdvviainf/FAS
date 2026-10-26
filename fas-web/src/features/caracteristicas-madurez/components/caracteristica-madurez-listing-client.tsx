'use client'

import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { CaracteristicaMadurezFormSheet, type CaracteristicaMadurezItem } from './caracteristica-madurez-form-sheet'
import { caracteristicaMadurezExtraColumns } from './caracteristica-madurez-columns'

export function CaracteristicaMadurezListingClient() {
  return (
    <MantenedorListing
      recurso='caracteristicas-madurez'
      titulo='Característica de Madurez'
      extraColumns={caracteristicaMadurezExtraColumns}
      renderEditSheet={({ item, open, onOpenChange }) => (
        <CaracteristicaMadurezFormSheet
          item={item as unknown as CaracteristicaMadurezItem}
          open={open}
          onOpenChange={onOpenChange}
        />
      )}
    />
  )
}
