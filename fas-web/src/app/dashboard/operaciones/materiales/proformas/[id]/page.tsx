import PageContainer from '@/components/layout/page-container'
import { ProformaMaterialForm } from '@/features/materiales/proformas-venta/components/proforma-material-form'

export const metadata = {
  title: 'FAS — Proforma de Venta de Materiales',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)

  return (
    <PageContainer
      pageTitle='Proforma de Venta de Materiales'
      pageDescription='Editable mientras esté en borrador.'
    >
      <div className='max-w-5xl'>
        <ProformaMaterialForm proformaMaterialId={id} />
      </div>
    </PageContainer>
  )
}
