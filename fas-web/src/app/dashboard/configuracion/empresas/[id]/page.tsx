import PageContainer from '@/components/layout/page-container'
import { EmpresaForm } from '@/features/empresas/components/empresa-form'

export const metadata = {
  title: 'FAS — Editar Empresa',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)

  return (
    <PageContainer
      pageTitle='Editar Empresa'
      pageDescription='Modifica los datos de la empresa.'
    >
      <div className='max-w-4xl'>
        <EmpresaForm empresaId={id} />
      </div>
    </PageContainer>
  )
}
