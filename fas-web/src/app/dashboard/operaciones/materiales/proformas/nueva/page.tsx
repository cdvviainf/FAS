import PageContainer from '@/components/layout/page-container'
import { ProformaMaterialForm } from '@/features/materiales/proformas-venta/components/proforma-material-form'

export const metadata = {
  title: 'FAS — Nueva Proforma de Venta de Materiales',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Nueva Proforma de Venta de Materiales'
      pageDescription='Selecciona el Movimiento de Salida ya confirmado y agrega las condiciones comerciales.'
    >
      <div className='max-w-5xl'>
        <ProformaMaterialForm />
      </div>
    </PageContainer>
  )
}
