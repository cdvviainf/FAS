import PageContainer from '@/components/layout/page-container'
import { EmpresaForm } from '@/features/empresas/components/empresa-form'

export const metadata = {
  title: 'FAS — Nueva Empresa',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Nueva Empresa'
      pageDescription='Completa los datos de la nueva empresa.'
    >
      <div className='max-w-4xl'>
        <EmpresaForm />
      </div>
    </PageContainer>
  )
}
