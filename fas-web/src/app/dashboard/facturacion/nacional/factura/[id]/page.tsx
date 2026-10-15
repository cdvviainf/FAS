import PageContainer from '@/components/layout/page-container'
import { FacturaNacionalDetalleClient } from '@/features/facturacion-nacional/components/factura-nacional-detalle-client'

export const metadata = {
  title: 'FAS — Factura Nacional',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)

  return (
    <PageContainer
      pageTitle='Factura Nacional'
      pageDescription='Edita las líneas y datos, envía el borrador y timbra el DTE 33/34 vía LibreDTE.'
    >
      <FacturaNacionalDetalleClient id={id} />
    </PageContainer>
  )
}
