'use client'

import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { PaisFormSheet } from '@/components/shared/mantenedor-simple/pais-form-sheet'
import { paisExtraColumns } from '@/components/shared/mantenedor-simple/pais-columns'

// Wrapper client: el form de edición de País (PaisFormSheet, con el select de
// Mercado) se pasa vía renderEditSheet. No puede ir inline en la page (Server
// Component) porque una función definida en el server no cruza al cliente.
export function PaisesListing() {
  return (
    <MantenedorListing
      recurso='paises'
      titulo='País'
      extraColumns={paisExtraColumns}
      renderEditSheet={(props) => <PaisFormSheet {...props} />}
    />
  )
}
