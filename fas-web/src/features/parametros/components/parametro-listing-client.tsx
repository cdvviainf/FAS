'use client'

import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { ParametroFormSheet } from './parametro-form-sheet'
import { parametroExtraColumns } from './parametro-columns'

// Wrapper client: "Editar" usa el form dedicado (con Tipo de Parámetro y Código
// Aduana), no el genérico. renderEditSheet es una función y no puede cruzar el
// límite Server→Client desde page.tsx.
export function ParametroListingClient() {
  return (
    <MantenedorListing
      recurso='parametros'
      titulo='Parámetro'
      extraColumns={parametroExtraColumns}
      renderEditSheet={({ item, open, onOpenChange }) => (
        <ParametroFormSheet item={item} open={open} onOpenChange={onOpenChange} />
      )}
    />
  )
}
