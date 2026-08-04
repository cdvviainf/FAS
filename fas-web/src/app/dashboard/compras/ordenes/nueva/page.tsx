import PageContainer from '@/components/layout/page-container'
import { OrdenCompraForm } from '@/features/compras/ordenes-compra/components/orden-compra-form'

export const metadata = {
  title: 'FAS — Nueva Orden de Compra',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Nueva Orden de Compra'
      pageDescription='Completa el encabezado. Podrás agregar el detalle de fruta después de crearla.'
    >
      <div className='max-w-5xl'>
        <OrdenCompraForm />
      </div>
    </PageContainer>
  )
}
