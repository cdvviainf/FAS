import PageContainer from '@/components/layout/page-container'
import { InstructivoEmbalajeForm } from '@/features/compras/instructivo-embalaje/components/instructivo-form'

export const metadata = {
  title: 'FAS — Instructivo de Embalaje',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)

  return (
    <PageContainer
      pageTitle='Instructivo de Embalaje'
      pageDescription='Documento que instruye qué embalar.'
    >
      <div className='max-w-4xl'>
        <InstructivoEmbalajeForm instructivoId={id} />
      </div>
    </PageContainer>
  )
}
