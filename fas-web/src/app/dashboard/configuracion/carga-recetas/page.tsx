import PageContainer from '@/components/layout/page-container'
import { CargaRecetasClient } from '@/features/carga-recetas/components/carga-recetas-client'

export const metadata = {
  title: 'FAS — Carga de Recetas'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Carga de Recetas'
      pageDescription='Carga masiva de recetas: descarga la plantilla (Recetas + Detalle), complétala con embalajes y componentes existentes, y cárgala.'
    >
      <CargaRecetasClient />
    </PageContainer>
  )
}
