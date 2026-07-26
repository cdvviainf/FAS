import PageContainer from '@/components/layout/page-container'
import { NotaVentaForm } from '@/features/ventas/notas-venta/components/nota-venta-form'

export const metadata = {
  title: 'FAS — Nuevo Cierre Comercial',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Nuevo Cierre Comercial'
      pageDescription='Completa el encabezado. Podrás agregar las líneas de fruta después de crearla.'
    >
      <div className='max-w-4xl'>
        <NotaVentaForm />
      </div>
    </PageContainer>
  )
}
