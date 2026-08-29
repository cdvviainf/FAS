import PageContainer from '@/components/layout/page-container'
import { MovimientoForm } from '@/features/materiales/movimientos/components/movimiento-form'

export const metadata = {
  title: 'FAS — Nuevo Movimiento',
}

export default function Page() {
  return (
    <PageContainer
      pageTitle='Nuevo Movimiento'
      pageDescription='Elige el tipo y la fecha. Podrás agregar el detalle después de crear el borrador.'
    >
      <div className='max-w-3xl'>
        <MovimientoForm />
      </div>
    </PageContainer>
  )
}
