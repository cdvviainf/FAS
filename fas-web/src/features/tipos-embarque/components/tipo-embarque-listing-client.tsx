'use client'

import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { TipoEmbarqueFormSheet } from './tipo-embarque-form-sheet'
import { tipoEmbarqueExtraColumns } from './tipo-embarque-columns'

// `renderEditSheet` es una función — no se puede pasar de un Server Component
// (page.tsx) a un Client Component sin romper la serialización de React. Este
// wrapper client-side la define del lado correcto del límite.
export function TipoEmbarqueListingClient() {
  return (
    <MantenedorListing
      recurso='tipos-embarque'
      titulo='Tipo de Embarque'
      mostrarCodigoAduana
      extraColumns={tipoEmbarqueExtraColumns}
      renderEditSheet={({ item, open, onOpenChange }) => (
        <TipoEmbarqueFormSheet item={item} open={open} onOpenChange={onOpenChange} />
      )}
    />
  )
}
