import PageContainer from '@/components/layout/page-container'
import { ProformaProductorForm } from '@/features/productores/proformas-servicio/components/proforma-productor-form'

export const metadata = {
  title: 'FAS — Nueva Proforma a Productor',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Nueva Proforma a Productor'
      pageDescription='Selecciona el productor, las condiciones comerciales y agrega las líneas de servicio.'
    >
      <div className='max-w-5xl'>
        <ProformaProductorForm />
      </div>
    </PageContainer>
  )
}
