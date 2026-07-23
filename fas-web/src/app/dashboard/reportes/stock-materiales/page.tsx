import PageContainer from '@/components/layout/page-container'
import { ConsultaStockClient } from '@/features/materiales/stock/components/consulta-stock-client'

export const metadata = {
  title: 'FAS — Consulta de Stock por Receta'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Consulta de Stock por Receta'
      pageDescription='Dada una producción de embalajes, evalúa si hay stock de sus componentes por bodega.'
    >
      <ConsultaStockClient />
    </PageContainer>
  )
}
