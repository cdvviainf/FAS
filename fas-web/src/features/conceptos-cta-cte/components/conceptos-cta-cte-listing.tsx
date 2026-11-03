'use client'

import MantenedorListing from '@/components/shared/mantenedor-simple/mantenedor-listing'
import { ConceptoCtaCteFormSheet } from './concepto-form-sheet'
import { conceptoExtraColumns } from './concepto-columns'

// Wrapper client: la edición de Concepto Cta. Cte. debe usar el form dedicado
// (ConceptoCtaCteFormSheet, que incluye el campo "Naturaleza"), no el sheet
// genérico. Se pasa vía renderEditSheet — igual que PaisesListing. No puede ir
// inline en la page (Server Component) porque una función del server no cruza al
// cliente.
export function ConceptosCtaCteListing() {
  return (
    <MantenedorListing
      recurso='conceptos-cta-cte'
      titulo='Concepto'
      extraColumns={conceptoExtraColumns}
      renderEditSheet={(props) => <ConceptoCtaCteFormSheet {...props} />}
    />
  )
}
