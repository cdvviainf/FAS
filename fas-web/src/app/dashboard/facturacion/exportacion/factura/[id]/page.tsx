import PageContainer from '@/components/layout/page-container'
import { FacturaDetalleClient } from '@/features/facturacion-exportacion/components/factura-detalle-client'

export const metadata = {
  title: 'FAS — Factura de Exportación',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)

  return (
    <PageContainer
      pageTitle='Factura de Exportación'
      pageDescription='Edita valores y agrupación, luego emite el DTE 110 vía LibreDTE.'
    >
      <FacturaDetalleClient id={id} />
    </PageContainer>
  )
}
