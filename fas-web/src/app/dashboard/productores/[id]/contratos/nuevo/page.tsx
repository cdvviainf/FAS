import PageContainer from '@/components/layout/page-container'
import { ContratoForm } from '@/features/productores/contratos/components/contrato-form'

export const metadata = {
  title: 'FAS — Nuevo Contrato de Productor',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const entidadId = parseInt(params.id, 10)

  return (
    <PageContainer
      pageTitle='Nuevo Contrato de Productor'
      pageDescription='Requiere que el productor tenga un representante legal registrado (R3).'
    >
      <ContratoForm entidadId={entidadId} />
    </PageContainer>
  )
}
