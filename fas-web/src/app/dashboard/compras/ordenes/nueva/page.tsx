import PageContainer from '@/components/layout/page-container'
import { OrdenCompraForm } from '@/features/compras/ordenes-compra/components/orden-compra-form'

export const metadata = {
  title: 'FAS — Nueva Orden de Compra',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Nueva Orden de Compra'
      pageDescription='Encabezado, cuotas de pago y detalle de fruta a comprar.'
    >
      <div className='max-w-5xl'>
        <OrdenCompraForm />
      </div>
    </PageContainer>
  )
}
