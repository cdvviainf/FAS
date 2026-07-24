import PageContainer from '@/components/layout/page-container'
import { OrdenCompraForm } from '@/features/compras/ordenes-compra/components/orden-compra-form'

export const metadata = {
  title: 'FAS — Orden de Compra',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)

  return (
    <PageContainer
      pageTitle='Orden de Compra'
      pageDescription='Editable hasta la Recepción de Stock.'
    >
      <div className='max-w-5xl'>
        <OrdenCompraForm ordenCompraId={id} />
      </div>
    </PageContainer>
  )
}
