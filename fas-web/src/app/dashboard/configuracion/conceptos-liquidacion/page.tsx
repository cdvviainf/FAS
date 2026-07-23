import PageContainer from '@/components/layout/page-container'
import { ConceptoListingClient } from '@/features/conceptos-liquidacion/components/concepto-listing-client'
import { ConceptoFormSheetTrigger } from '@/features/conceptos-liquidacion/components/concepto-form-sheet'

export const metadata = {
  title: 'FAS — Conceptos de Liquidación'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Conceptos de Liquidación'
      pageDescription='Cobros y abonos aplicables a la liquidación del productor, con valor por especie.'
      pageHeaderAction={<ConceptoFormSheetTrigger />}
    >
      <ConceptoListingClient />
    </PageContainer>
  )
}
