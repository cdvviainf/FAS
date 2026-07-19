import PageContainer from '@/components/layout/page-container'
import { PerfilForm } from '@/features/perfiles/components/perfil-form'

export const metadata = {
  title: 'FAS — Nuevo Perfil'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Nuevo Perfil'
      pageDescription='Crea un nuevo perfil de acceso con su matriz de permisos.'
    >
      <div className='max-w-4xl'>
        <PerfilForm />
      </div>
    </PageContainer>
  )
}
