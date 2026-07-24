import PageContainer from '@/components/layout/page-container'
import { NotaVentaForm } from '@/features/ventas/notas-venta/components/nota-venta-form'

export const metadata = {
  title: 'FAS — Nueva Nota de Venta',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Nueva Nota de Venta'
      pageDescription='Completa el encabezado. Podrás agregar las líneas de fruta después de crearla.'
    >
      <div className='max-w-4xl'>
        <NotaVentaForm />
      </div>
    </PageContainer>
  )
}
