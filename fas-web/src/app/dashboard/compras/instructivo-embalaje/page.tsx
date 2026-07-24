import PageContainer from '@/components/layout/page-container'
import { InstructivoListingClient } from '@/features/compras/instructivo-embalaje/components/instructivo-listing-client'

export const metadata = {
  title: 'FAS — Instructivo de Embalaje',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Instructivo de Embalaje'
      pageDescription='Documentos que instruyen qué embalar, emitidos en el contexto de un Cierre Comercial.'
    >
      <InstructivoListingClient />
    </PageContainer>
  )
}
