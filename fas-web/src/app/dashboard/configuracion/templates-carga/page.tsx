import PageContainer from '@/components/layout/page-container'
import { TemplateCargaListingClient } from '@/features/templates-carga/components/template-carga-listing-client'
import { TemplateCargaFormSheetTrigger } from '@/features/templates-carga/components/template-carga-form-sheet'

export const metadata = {
  title: 'FAS — Templates de Carga'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Templates de Carga'
      pageDescription='Mapeo de columnas del Excel de Recepción de Stock: en qué fila empiezan los datos y qué columna corresponde a cada campo.'
      pageHeaderAction={<TemplateCargaFormSheetTrigger />}
    >
      <TemplateCargaListingClient />
    </PageContainer>
  )
}
