'use client'

import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { TipoReclamoFormSheet } from './tipo-reclamo-form-sheet'
import { tipoReclamoExtraColumns } from './tipo-reclamo-columns'

// `renderEditSheet` es una función — no se puede pasar de un Server Component
// (page.tsx) a un Client Component (MantenedorListing/MantenedorTable) sin
// que React falle al serializarla. Este wrapper client-side la define del
// lado correcto del límite.
export function TipoReclamoListingClient() {
  return (
    <MantenedorListing
      recurso='tipos-reclamo'
      titulo='Tipo de Reclamo'
      extraColumns={tipoReclamoExtraColumns}
      renderEditSheet={({ item, open, onOpenChange }) => (
        <TipoReclamoFormSheet item={item} open={open} onOpenChange={onOpenChange} />
      )}
    />
  )
}
