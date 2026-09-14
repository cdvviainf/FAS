import PageContainer from '@/components/layout/page-container'
import { CargaMaestrosClient } from '@/features/carga-maestros/components/carga-maestros-client'

export const metadata = {
  title: 'FAS — Carga Masiva de Maestros'
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Carga Masiva de Maestros'
      pageDescription='Descarga la plantilla, complétala y cárgala para poblar los maestros de una sola vez.'
    >
      <CargaMaestrosClient />
    </PageContainer>
  )
}
