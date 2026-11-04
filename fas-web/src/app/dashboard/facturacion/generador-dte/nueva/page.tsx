import PageContainer from '@/components/layout/page-container'
import { GeneradorDteForm } from '@/features/facturacion/generador-dte/components/generador-dte-form'

export const metadata = {
  title: 'FAS — Nuevo documento (Generador DTE)',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Nuevo documento'
      pageDescription='Selecciona el tipo de documento, el receptor y el detalle. Queda en borrador para previsualizar su PDF.'
    >
      <div className='max-w-5xl'>
        <GeneradorDteForm />
      </div>
    </PageContainer>
  )
}
