import PageContainer from '@/components/layout/page-container'
import { OrdenCompraMaterialForm } from '@/features/materiales/ordenes-compra/components/orden-compra-material-form'

export const metadata = {
  title: 'FAS — Orden de Compra de Materiales',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)

  return (
    <PageContainer
      pageTitle='Orden de Compra de Materiales'
      pageDescription='Editable mientras esté en borrador.'
    >
      <div className='max-w-5xl'>
        <OrdenCompraMaterialForm ordenCompraMaterialId={id} />
      </div>
    </PageContainer>
  )
}
