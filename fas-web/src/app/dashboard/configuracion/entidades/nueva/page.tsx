import PageContainer from '@/components/layout/page-container'
import { EntidadForm } from '@/features/entidades/components/entidad-form'

export const metadata = {
  title: 'FAS — Nueva Entidad',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Nueva Entidad'
      pageDescription='Completa los datos de la nueva entidad.'
    >
      <div className='max-w-4xl'>
        <EntidadForm />
      </div>
    </PageContainer>
  )
}
