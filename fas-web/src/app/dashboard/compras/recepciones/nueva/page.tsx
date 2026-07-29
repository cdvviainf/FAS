import PageContainer from '@/components/layout/page-container'
import { RecepcionForm } from '@/features/compras/recepciones/components/recepcion-form'

export const metadata = {
  title: 'FAS — Nueva Recepción',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Nueva Recepción'
      pageDescription='Encabezado de la Recepción. El archivo Excel se sube después de crearla.'
    >
      <div className='max-w-3xl'>
        <RecepcionForm />
      </div>
    </PageContainer>
  )
}
