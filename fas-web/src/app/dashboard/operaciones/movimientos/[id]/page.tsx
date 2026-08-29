import PageContainer from '@/components/layout/page-container'
import { MovimientoForm } from '@/features/materiales/movimientos/components/movimiento-form'

export const metadata = {
  title: 'FAS — Movimiento',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)

  return (
    <PageContainer pageTitle='Movimiento' pageDescription='Editable mientras esté en borrador.'>
      <div className='max-w-3xl'>
        <MovimientoForm movimientoId={id} />
      </div>
    </PageContainer>
  )
}
