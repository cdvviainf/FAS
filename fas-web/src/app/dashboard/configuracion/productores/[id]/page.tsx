import PageContainer from '@/components/layout/page-container'
import { ProductorFichaClient } from '@/features/productores/components/productor-ficha-client'

export const metadata = {
  title: 'FAS — Ficha de Productor',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)

  return (
    <PageContainer
      pageTitle='Ficha de Productor'
      pageDescription='Predios, contrato y cuenta corriente del productor.'
    >
      <ProductorFichaClient entidadId={id} />
    </PageContainer>
  )
}
