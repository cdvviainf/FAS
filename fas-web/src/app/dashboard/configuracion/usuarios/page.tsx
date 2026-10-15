import PageContainer from '@/components/layout/page-container'
import { UsuarioListingClient } from '@/features/usuarios/components/usuario-listing-client'
import { NuevoUsuarioButton } from '@/features/usuarios/components/nuevo-usuario-button'

export const metadata = {
  title: 'FAS — Usuarios'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Usuarios'
      pageDescription='Gestiona los usuarios del sistema y su perfil de acceso.'
      pageHeaderAction={<NuevoUsuarioButton />}
    >
      <UsuarioListingClient />
    </PageContainer>
  )
}
