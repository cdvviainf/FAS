import PageContainer from '@/components/layout/page-container'
import { ProformaProductorForm } from '@/features/productores/proformas-servicio/components/proforma-productor-form'

export const metadata = {
  title: 'FAS — Proforma a Productor',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)

  return (
    <PageContainer
      pageTitle='Proforma a Productor'
      pageDescription='Editable mientras esté en borrador.'
    >
      <div className='max-w-5xl'>
        <ProformaProductorForm proformaProductorId={id} />
      </div>
    </PageContainer>
  )
}
