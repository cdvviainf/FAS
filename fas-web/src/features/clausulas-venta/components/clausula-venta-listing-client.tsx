'use client'

import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { ClausulaVentaFormSheet } from './clausula-venta-form-sheet'
import { clausulaVentaExtraColumns } from './clausula-venta-columns'

// `renderEditSheet` es una función — no se puede pasar de un Server Component
// (page.tsx) a un Client Component (MantenedorListing/MantenedorTable) sin
// que React falle al serializarla. Este wrapper client-side la define del
// lado correcto del límite.
export function ClausulaVentaListingClient() {
  return (
    <MantenedorListing
      recurso='clausulas-venta'
      titulo='Cláusula de Venta'
      extraColumns={clausulaVentaExtraColumns}
      renderEditSheet={({ item, open, onOpenChange }) => (
        <ClausulaVentaFormSheet item={item} open={open} onOpenChange={onOpenChange} />
      )}
    />
  )
}
