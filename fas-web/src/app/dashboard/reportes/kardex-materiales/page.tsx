import PageContainer from '@/components/layout/page-container'
import { KardexMaterialesClient } from '@/features/reportes/kardex-materiales/components/kardex-materiales-client'

export const metadata = {
  title: 'FAS — Kardex de Materiales',
}

export default function Page() {
  return (
    <PageContainer pageTitle='Kardex de Materiales'>
      <KardexMaterialesClient />
    </PageContainer>
  )
}
