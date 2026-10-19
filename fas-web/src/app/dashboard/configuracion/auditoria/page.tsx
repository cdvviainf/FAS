import PageContainer from '@/components/layout/page-container'
import { AuditoriaClient } from '@/features/reportes/auditoria/components/auditoria-client'

export const metadata = {
  title: 'FAS — Auditoría',
}

export default function Page() {
  return (
    <PageContainer pageTitle='Auditoría'>
      <AuditoriaClient />
    </PageContainer>
  )
}
