import PageContainer from '@/components/layout/page-container'
import { ContratoForm } from '@/features/productores/contratos/components/contrato-form'

export const metadata = {
  title: 'FAS — Contrato de Productor',
}

type PageProps = {
  params: Promise<{ id: string; contratoId: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const entidadId = parseInt(params.id, 10)
  const contratoId = parseInt(params.contratoId, 10)

  return (
    <PageContainer
      pageTitle='Contrato de Productor'
      pageDescription='Datos generales, detalle por línea con condición de pago y documentos adjuntos.'
    >
      <ContratoForm entidadId={entidadId} contratoId={contratoId} />
    </PageContainer>
  )
}
