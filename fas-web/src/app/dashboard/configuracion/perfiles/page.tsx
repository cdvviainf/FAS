import PageContainer from '@/components/layout/page-container'
import { PerfilListingClient } from '@/features/perfiles/components/perfil-listing-client'
import { NuevoPerfilButton } from '@/features/perfiles/components/nuevo-perfil-button'

export const metadata = {
  title: 'FAS — Perfiles'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Perfiles'
      pageDescription='Gestiona los perfiles de acceso y su matriz de permisos por ítem de menú.'
      pageHeaderAction={<NuevoPerfilButton />}
    >
      <PerfilListingClient />
    </PageContainer>
  )
}
