import PageContainer from '@/components/layout/page-container'
import { EntidadForm } from '@/features/entidades/components/entidad-form'

export const metadata = {
  title: 'FAS — Editar Entidad',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)

  return (
    <PageContainer
      pageTitle='Editar Entidad'
      pageDescription='Modifica los datos de la entidad.'
    >
      <div className='max-w-4xl'>
        <EntidadForm entidadId={id} />
      </div>
    </PageContainer>
  )
}
