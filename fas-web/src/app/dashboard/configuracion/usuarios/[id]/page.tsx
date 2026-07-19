import PageContainer from '@/components/layout/page-container'
import { UsuarioForm } from '@/features/usuarios/components/usuario-form'

export const metadata = {
  title: 'FAS — Editar Usuario'
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params

  return (
    <PageContainer
      pageTitle='Editar Usuario'
      pageDescription='Modifica los datos del usuario.'
    >
      <div className='max-w-3xl'>
        <UsuarioForm usuarioId={params.id} />
      </div>
    </PageContainer>
  )
}
