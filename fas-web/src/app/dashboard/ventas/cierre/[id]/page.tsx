import PageContainer from '@/components/layout/page-container'
import { NotaVentaForm } from '@/features/ventas/notas-venta/components/nota-venta-form'

export const metadata = {
  title: 'FAS — Editar Cierre Comercial',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)

  return (
    <PageContainer
      pageTitle='Cierre Comercial'
      pageDescription='Modifica el encabezado o agrega líneas de fruta comprometida.'
    >
      <div className='max-w-4xl'>
        <NotaVentaForm notaVentaId={id} />
      </div>
    </PageContainer>
  )
}
