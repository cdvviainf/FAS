import PageContainer from '@/components/layout/page-container'
import { GeneradorDteForm } from '@/features/facturacion/generador-dte/components/generador-dte-form'

export const metadata = {
  title: 'FAS — Documento (Generador DTE)',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)

  return (
    <PageContainer
      pageTitle='Documento'
      pageDescription='Editable mientras esté en borrador.'
    >
      <div className='max-w-5xl'>
        <GeneradorDteForm documentoId={id} />
      </div>
    </PageContainer>
  )
}
