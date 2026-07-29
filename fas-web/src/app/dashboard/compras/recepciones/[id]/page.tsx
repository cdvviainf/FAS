import PageContainer from '@/components/layout/page-container'
import { RecepcionForm } from '@/features/compras/recepciones/components/recepcion-form'

export const metadata = {
  title: 'FAS — Recepción',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)

  return (
    <PageContainer
      pageTitle='Recepción'
      pageDescription='Editable mientras esté en estado Cargada.'
    >
      <div className='max-w-3xl'>
        <RecepcionForm recepcionId={id} />
      </div>
    </PageContainer>
  )
}
