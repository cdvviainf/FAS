import PageContainer from '@/components/layout/page-container'
import { NotaCondicionListingClient } from '@/features/notas-condicion/components/nota-condicion-listing-client'
import { NotaCondicionFormSheetTrigger } from '@/features/notas-condicion/components/nota-condicion-form-sheet'

export const metadata = {
  title: 'FAS — Notas de Condición'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Notas de Condición'
      pageDescription='Catálogo de notas de condición (ej. 1, 2, 3, 4) y las especies para las que es válida cada una.'
      pageHeaderAction={<NotaCondicionFormSheetTrigger />}
    >
      <NotaCondicionListingClient />
    </PageContainer>
  )
}
