import PageContainer from '@/components/layout/page-container'
import { InstructivoEmbalajeForm } from '@/features/compras/instructivo-embalaje/components/instructivo-form'

export const metadata = {
  title: 'FAS — Nuevo Instructivo de Embalaje',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Nuevo Instructivo de Embalaje'
      pageDescription='Documento que instruye qué embalar. Una vez emitido no se puede editar.'
    >
      <div className='max-w-4xl'>
        <InstructivoEmbalajeForm />
      </div>
    </PageContainer>
  )
}
