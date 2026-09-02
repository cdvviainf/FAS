import PageContainer from '@/components/layout/page-container'
import { NotaCalidadListingClient } from '@/features/notas-calidad/components/nota-calidad-listing-client'
import { NotaCalidadFormSheetTrigger } from '@/features/notas-calidad/components/nota-calidad-form-sheet'

export const metadata = {
  title: 'FAS — Notas de Calidad'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Notas de Calidad'
      pageDescription='Catálogo de notas de calidad (ej. A, B, C, D) y las especies para las que es válida cada una.'
      pageHeaderAction={<NotaCalidadFormSheetTrigger />}
    >
      <NotaCalidadListingClient />
    </PageContainer>
  )
}
