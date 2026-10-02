'use client'

import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { PuertoFormSheet } from './puerto-form-sheet'
import { puertoExtraColumns } from './puerto-columns'

// `renderEditSheet` es una función — no se puede pasar de un Server Component
// (page.tsx) a un Client Component sin que React falle al serializarla. Este
// wrapper la define del lado client. Antes el listado no pasaba renderEditSheet,
// así que "Editar" caía en el form genérico (solo código/descripción) y se
// perdían País, Tipo de Embarque, coordenadas y el Código Aduana (SII).
export function PuertoListingClient() {
  return (
    <MantenedorListing
      recurso='puertos'
      titulo='Puerto'
      extraColumns={puertoExtraColumns}
      renderEditSheet={({ item, open, onOpenChange }) => (
        <PuertoFormSheet item={item} open={open} onOpenChange={onOpenChange} />
      )}
    />
  )
}
