import PageContainer from '@/components/layout/page-container'
import { OrdenCompraMaterialForm } from '@/features/materiales/ordenes-compra/components/orden-compra-material-form'

export const metadata = {
  title: 'FAS — Nueva Orden de Compra de Materiales',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Nueva Orden de Compra de Materiales'
      pageDescription='Completa el encabezado. Podrás agregar el detalle de líneas después de crearla.'
    >
      <div className='max-w-5xl'>
        <OrdenCompraMaterialForm />
      </div>
    </PageContainer>
  )
}
