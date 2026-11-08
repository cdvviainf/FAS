import PageContainer from '@/components/layout/page-container'
import { MonitorDteClient } from '@/features/facturacion/monitor-dte/components/monitor-dte-client'

export const metadata = {
  title: 'FAS — Monitor DTE',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Monitor DTE'
      pageDescription='Documentos electrónicos emitidos y firmados, con su estado en el SII. Descarga del XML y del PDF timbrado.'
    >
      <MonitorDteClient />
    </PageContainer>
  )
}
