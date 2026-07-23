import PageContainer from '@/components/layout/page-container'
import { RecetaListingClient } from '@/features/materiales/recetas/components/receta-listing-client'

export const metadata = {
  title: 'FAS — Recetas'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Recetas de Embalaje'
      pageDescription='Componentes (materiales de embalaje y servicios) que consume cada embalaje.'
    >
      <RecetaListingClient />
    </PageContainer>
  )
}
