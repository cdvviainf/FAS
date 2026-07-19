import PageContainer from '@/components/layout/page-container'
import { PerfilForm } from '@/features/perfiles/components/perfil-form'

export const metadata = {
  title: 'FAS — Editar Perfil'
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const perfilId = parseInt(params.id, 10)

  return (
    <PageContainer
      pageTitle='Editar Perfil'
      pageDescription='Modifica el perfil de acceso y su matriz de permisos.'
    >
      <div className='max-w-4xl'>
        <PerfilForm perfilId={perfilId} />
      </div>
    </PageContainer>
  )
}
