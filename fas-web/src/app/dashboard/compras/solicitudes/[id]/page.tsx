import PageContainer from '@/components/layout/page-container'
import { SolicitudForm } from '@/features/solicitudes-inspeccion/components/solicitud-form'

export const metadata = {
  title: 'FAS — Solicitud de Inspección',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const id = parseInt(params.id, 10)

  return (
    <PageContainer
      pageTitle='Solicitud de Inspección'
      pageDescription='Editable mientras no esté cerrada.'
    >
      <div className='max-w-5xl'>
        <SolicitudForm solicitudId={id} />
      </div>
    </PageContainer>
  )
}
